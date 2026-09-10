import { useCallback, useEffect, useMemo, useState } from "react";
import { BellRing, Megaphone, Plus } from "lucide-react";
import { useAuth } from "../auth/authContext.js";
import { USER_ROLES } from "../auth/roles.js";
import { getApiErrorMessage } from "../api/errors.js";
import {
  Badge,
  Button,
  Dialog,
  EmptyState,
  ErrorState,
  Input,
  LoadingState,
  PageHeader,
  Select,
  Textarea,
} from "../components/ui/index.js";
import { useToast } from "../feedback/toastContext.js";
import {
  getNoticeAudienceLocations,
  listManagedNotices,
  listMyNotices,
  markNoticeRead,
  publishNotice,
} from "../notices/noticeApi.js";
import {
  buildNoticePayload,
  formatNoticeDate,
  getAudienceLabel,
  getPriorityLabel,
  getPriorityTone,
  NOTICE_AUDIENCES,
  NOTICE_PRIORITIES,
  validateNoticeForm,
} from "../notices/noticeView.js";
import { PaginationControls } from "../residents/PaginationControls.jsx";

const EMPTY_PAGINATION = { page: 1, pageSize: 10, total: 0, totalPages: 0 };
const EMPTY_FORM = {
  title: "",
  body: "",
  priority: NOTICE_PRIORITIES.NORMAL,
  audienceType: NOTICE_AUDIENCES.ALL_RESIDENTS,
  role: USER_ROLES.STUDENT,
  hostelId: "",
  blockId: "",
  expiresAt: "",
};
const ROLE_OPTIONS = [
  [USER_ROLES.STUDENT, "Students"],
  [USER_ROLES.WARDEN, "Wardens"],
  [USER_ROLES.MAINTENANCE, "Maintenance staff"],
  [USER_ROLES.GUARD, "Gate security"],
  [USER_ROLES.ADMIN, "Administrators"],
];

const NoticeCard = ({ notice, managed, reading, onRead }) => (
  <article className={`hm-notice-card hm-notice-card--${notice.priority}${notice.isRead === false ? " hm-notice-card--unread" : ""}`}>
    <div className="hm-notice-card__heading">
      <div>
        <div className="hm-notice-card__badges">
          <Badge tone={getPriorityTone(notice.priority)}>{getPriorityLabel(notice.priority)}</Badge>
          {notice.isRead === false && <Badge tone="brand">Unread</Badge>}
          {!notice.isActive && <Badge tone="neutral">Expired</Badge>}
        </div>
        <h2>{notice.title}</h2>
      </div>
      {!managed && notice.isRead === false && (
        <Button loading={reading} loadingLabel="Marking read" onClick={() => onRead(notice.id)}>
          Mark as read
        </Button>
      )}
    </div>
    <p className="hm-notice-card__body">{notice.body}</p>
    <dl className="hm-notice-card__meta">
      <div><dt>Audience</dt><dd>{getAudienceLabel(notice.audience)}</dd></div>
      <div><dt>Published</dt><dd>{formatNoticeDate(notice.publishedAt)}</dd></div>
      <div><dt>Published by</dt><dd>{notice.publisher?.name || "Hostel administration"}</dd></div>
      {managed && <div><dt>Recipients</dt><dd>{notice.recipientCount}</dd></div>}
      {notice.expiresAt && <div><dt>Expires</dt><dd>{formatNoticeDate(notice.expiresAt)}</dd></div>}
    </dl>
  </article>
);

const NoticeEditor = ({ open, onDismiss, onPublished }) => {
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [locations, setLocations] = useState([]);
  const [locationError, setLocationError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    if (!open) return;
    setLocationError("");
    getNoticeAudienceLocations()
      .then(setLocations)
      .catch((error) => setLocationError(
        getApiErrorMessage(error, "Hostel and block options could not be loaded.")
      ));
  }, [open]);

  const updateForm = (field, value) => {
    setForm((current) => {
      const next = { ...current, [field]: value };
      if (field === "audienceType") {
        next.hostelId = "";
        next.blockId = "";
      }
      if (field === "hostelId") next.blockId = "";
      return next;
    });
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const selectedHostel = locations.find((hostel) => String(hostel.id) === form.hostelId);
  const needsHostel = [NOTICE_AUDIENCES.HOSTEL, NOTICE_AUDIENCES.BLOCK].includes(form.audienceType);

  const close = () => {
    if (submitting) return;
    setForm(EMPTY_FORM);
    setErrors({});
    onDismiss();
  };

  const submit = async (event) => {
    event.preventDefault();
    const nextErrors = validateNoticeForm(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    try {
      setSubmitting(true);
      const notice = await publishNotice(buildNoticePayload(form));
      showToast({
        tone: "success",
        title: "Notice published",
        message: `Sent to ${notice.recipientCount} recipient${notice.recipientCount === 1 ? "" : "s"}.`,
      });
      setForm(EMPTY_FORM);
      setErrors({});
      onPublished(notice);
    } catch (error) {
      showToast({
        tone: "danger",
        title: "Notice was not published",
        message: getApiErrorMessage(error, "Review the notice and try again."),
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      title="Publish notice"
      description="Choose the smallest audience that needs this information. Published notices cannot be edited."
      onDismiss={close}
      dismissDisabled={submitting}
      className="hm-notice-editor"
      footer={
        <>
          <Button disabled={submitting} onClick={close}>Cancel</Button>
          <Button variant="primary" type="submit" form="notice-editor-form" loading={submitting} loadingLabel="Publishing">
            Publish notice
          </Button>
        </>
      }
    >
      <form id="notice-editor-form" className="hm-notice-editor__form" onSubmit={submit}>
        <Input
          label="Title"
          required
          maxLength={160}
          value={form.title}
          error={errors.title}
          hint={`${form.title.length}/160 characters`}
          onChange={(event) => updateForm("title", event.target.value)}
        />
        <Textarea
          label="Notice details"
          required
          rows={6}
          maxLength={5000}
          value={form.body}
          error={errors.body}
          hint={`${form.body.length}/5000 characters`}
          onChange={(event) => updateForm("body", event.target.value)}
        />
        <div className="hm-notice-editor__row">
          <Select label="Priority" value={form.priority} onChange={(event) => updateForm("priority", event.target.value)}>
            <option value={NOTICE_PRIORITIES.NORMAL}>Normal</option>
            <option value={NOTICE_PRIORITIES.IMPORTANT}>Important</option>
            <option value={NOTICE_PRIORITIES.URGENT}>Urgent</option>
          </Select>
          <Select label="Audience" value={form.audienceType} onChange={(event) => updateForm("audienceType", event.target.value)}>
            <option value={NOTICE_AUDIENCES.ALL_RESIDENTS}>All residents</option>
            <option value={NOTICE_AUDIENCES.ROLE}>A specific role</option>
            <option value={NOTICE_AUDIENCES.HOSTEL}>A hostel</option>
            <option value={NOTICE_AUDIENCES.BLOCK}>A hostel block</option>
          </Select>
        </div>
        {form.audienceType === NOTICE_AUDIENCES.ROLE && (
          <Select label="Role" value={form.role} onChange={(event) => updateForm("role", event.target.value)}>
            {ROLE_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </Select>
        )}
        {needsHostel && (
          <Select
            label="Hostel"
            required
            value={form.hostelId}
            error={errors.hostelId || locationError}
            disabled={Boolean(locationError)}
            onChange={(event) => updateForm("hostelId", event.target.value)}
          >
            <option value="">Select hostel</option>
            {locations.map((hostel) => (
              <option key={hostel.id} value={hostel.id}>{hostel.code} · {hostel.name}</option>
            ))}
          </Select>
        )}
        {form.audienceType === NOTICE_AUDIENCES.BLOCK && (
          <Select
            label="Block"
            required
            value={form.blockId}
            error={errors.blockId}
            disabled={!selectedHostel}
            onChange={(event) => updateForm("blockId", event.target.value)}
          >
            <option value="">Select block</option>
            {(selectedHostel?.blocks || []).map((block) => (
              <option key={block.id} value={block.id}>{block.code} · {block.name}</option>
            ))}
          </Select>
        )}
        <Input
          label="Expiry (optional)"
          type="datetime-local"
          value={form.expiresAt}
          error={errors.expiresAt}
          hint="Leave empty to keep the notice active."
          onChange={(event) => updateForm("expiresAt", event.target.value)}
        />
      </form>
    </Dialog>
  );
};

const Notices = () => {
  const { user } = useAuth();
  const canPublish = [USER_ROLES.ADMIN, USER_ROLES.WARDEN].includes(user.role);
  const [view, setView] = useState("mine");
  const [notices, setNotices] = useState([]);
  const [pagination, setPagination] = useState(EMPTY_PAGINATION);
  const [page, setPage] = useState(1);
  const [readState, setReadState] = useState("all");
  const [priority, setPriority] = useState("");
  const [state, setState] = useState("active");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [readingId, setReadingId] = useState(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const { showToast } = useToast();

  const filters = useMemo(() => ({
    page,
    state,
    priority: priority || undefined,
    ...(view === "mine" ? { readState } : {}),
  }), [page, priority, readState, state, view]);

  const loadNotices = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const result = view === "managed"
        ? await listManagedNotices(filters)
        : await listMyNotices(filters);
      setNotices(Array.isArray(result?.data) ? result.data : []);
      setPagination(result?.pagination || EMPTY_PAGINATION);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, "Notices could not be loaded."));
    } finally {
      setLoading(false);
    }
  }, [filters, view]);

  useEffect(() => {
    loadNotices();
  }, [loadNotices, reloadToken]);

  const selectView = (nextView) => {
    setView(nextView);
    setPage(1);
    setState(nextView === "managed" ? "all" : "active");
  };

  const readNotice = async (noticeId) => {
    try {
      setReadingId(noticeId);
      const result = await markNoticeRead(noticeId);
      setNotices((current) => current.map((notice) =>
        notice.id === noticeId ? { ...notice, isRead: true, readAt: result.readAt } : notice
      ));
    } catch (requestError) {
      showToast({
        tone: "danger",
        title: "Notice was not updated",
        message: getApiErrorMessage(requestError, "Try again in a moment."),
      });
    } finally {
      setReadingId(null);
    }
  };

  return (
    <div className="hm-page-stack hm-page-stack--wide hm-notices-page">
      <PageHeader
        eyebrow="Hostel communication"
        title="Notices"
        description="Official announcements for your hostel, block, or role."
        actions={canPublish && (
          <Button variant="primary" leadingIcon={<Plus aria-hidden="true" />} onClick={() => setEditorOpen(true)}>
            Publish notice
          </Button>
        )}
      />

      {canPublish && (
        <div className="hm-notices-tabs" role="group" aria-label="Notice views">
          <button aria-pressed={view === "mine"} onClick={() => selectView("mine")}>My notices</button>
          <button aria-pressed={view === "managed"} onClick={() => selectView("managed")}>Published notices</button>
        </div>
      )}

      <section className="hm-notices-toolbar" aria-label="Notice filters">
        <Select label="Status" value={state} onChange={(event) => { setState(event.target.value); setPage(1); }}>
          {view === "mine" && <option value="active">Active notices</option>}
          <option value="all">All notices</option>
          <option value="expired">Expired notices</option>
        </Select>
        {view === "mine" && (
          <Select label="Read state" value={readState} onChange={(event) => { setReadState(event.target.value); setPage(1); }}>
            <option value="all">All</option>
            <option value="unread">Unread</option>
            <option value="read">Read</option>
          </Select>
        )}
        <Select label="Priority" value={priority} onChange={(event) => { setPriority(event.target.value); setPage(1); }}>
          <option value="">All priorities</option>
          <option value={NOTICE_PRIORITIES.NORMAL}>Normal</option>
          <option value={NOTICE_PRIORITIES.IMPORTANT}>Important</option>
          <option value={NOTICE_PRIORITIES.URGENT}>Urgent</option>
        </Select>
      </section>

      {loading ? (
        <LoadingState label="Loading notices" rows={4} />
      ) : error ? (
        <ErrorState title="Notices are unavailable" description={error} onRetry={loadNotices} />
      ) : notices.length === 0 ? (
        <EmptyState
          icon={view === "managed" ? Megaphone : BellRing}
          title={view === "managed" ? "No notices published" : "No notices to show"}
          description={view === "managed" ? "Published announcements will appear here." : "There are no notices matching these filters."}
        />
      ) : (
        <div className="hm-notice-list">
          {notices.map((notice) => (
            <NoticeCard
              key={notice.id}
              notice={notice}
              managed={view === "managed"}
              reading={readingId === notice.id}
              onRead={readNotice}
            />
          ))}
        </div>
      )}

      {!loading && !error && (
        <PaginationControls
          pagination={pagination}
          disabled={loading}
          label="Notices pagination"
          onPageChange={setPage}
        />
      )}

      <NoticeEditor
        open={editorOpen}
        onDismiss={() => setEditorOpen(false)}
        onPublished={() => {
          setEditorOpen(false);
          setView("managed");
          setState("all");
          setPage(1);
          setReloadToken((current) => current + 1);
        }}
      />
    </div>
  );
};

export default Notices;
