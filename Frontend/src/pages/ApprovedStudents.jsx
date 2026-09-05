import { useCallback, useEffect, useRef, useState } from "react";
import {
  Building2,
  MailPlus,
  RotateCcw,
  Search,
  UserCheck,
  UserPlus,
  UserX,
} from "lucide-react";
import api from "../api/axios.js";
import { getApiErrorMessage } from "../api/errors.js";
import {
  Button,
  ConfirmationDialog,
  Dialog,
  EmptyState,
  ErrorState,
  Input,
  LoadingState,
  PageHeader,
  Panel,
  Select,
  StatusBadge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
  Textarea,
} from "../components/ui/index.js";
import { useToast } from "../feedback/toastContext.js";
import {
  APPROVAL_ACTIONS,
  APPROVAL_STATUSES,
  APPROVAL_STATUS_OPTIONS,
  formatApprovalDate,
  getApprovalActions,
  getApprovalStatusLabel,
  getApprovalStatusTone,
} from "../onboarding/approvedStudentView.js";

const EMPTY_FORM = Object.freeze({
  name: "",
  email: "",
  rollNo: "",
  hostelCode: "",
});

const EMPTY_PAGINATION = Object.freeze({
  page: 1,
  pageSize: 20,
  total: 0,
  totalPages: 0,
});

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ROLL_NO_PATTERN = /^[A-Z0-9][A-Z0-9 /-]{1,49}$/;

const validateApprovalForm = (form, hostelCodes) => {
  const errors = {};
  const name = form.name.trim();
  const email = form.email.trim();
  const rollNo = form.rollNo.trim().replace(/\s+/g, " ").toUpperCase();

  if (name.length < 2) {
    errors.name = "Enter the student's full name.";
  }
  if (!EMAIL_PATTERN.test(email)) {
    errors.email = "Enter a valid institutional email address.";
  }
  if (!ROLL_NO_PATTERN.test(rollNo)) {
    errors.rollNo = "Enter a valid institutional roll number.";
  }
  if (!hostelCodes.has(form.hostelCode)) {
    errors.hostelCode = "Select the student's assigned hostel.";
  }

  return errors;
};

const getServerFieldErrors = (error) => {
  const serverErrors = error?.response?.data?.fieldErrors ?? {};
  const fields = ["name", "email", "rollNo", "hostelCode"];

  return Object.fromEntries(
    fields
      .map((field) => [field, serverErrors[`body.${field}`]])
      .filter(([, message]) => Boolean(message))
  );
};

const actionLabels = Object.freeze({
  [APPROVAL_ACTIONS.SEND_ACTIVATION]: "Send activation",
  [APPROVAL_ACTIONS.RESEND_ACTIVATION]: "Resend activation",
  [APPROVAL_ACTIONS.REVOKE]: "Revoke",
  [APPROVAL_ACTIONS.REINSTATE]: "Reinstate",
});

const getActionIcon = (action) => {
  switch (action) {
    case APPROVAL_ACTIONS.SEND_ACTIVATION:
      return <MailPlus size={16} aria-hidden="true" />;
    case APPROVAL_ACTIONS.RESEND_ACTIVATION:
      return <RotateCcw size={16} aria-hidden="true" />;
    case APPROVAL_ACTIONS.REVOKE:
      return <UserX size={16} aria-hidden="true" />;
    case APPROVAL_ACTIONS.REINSTATE:
      return <UserCheck size={16} aria-hidden="true" />;
    default:
      return null;
  }
};

const getActionCopy = (action, student) => {
  const identity = `${student.name} (${student.rollNo})`;

  switch (action) {
    case APPROVAL_ACTIONS.SEND_ACTIVATION:
      return {
        title: "Send activation email?",
        description: `Send an account activation link to ${identity} at ${student.email}.`,
        confirmLabel: "Send activation",
        loadingLabel: "Sending",
        successTitle: "Activation email sent",
        successMessage: `A 30-minute activation link was sent to ${student.email}.`,
      };
    case APPROVAL_ACTIONS.RESEND_ACTIVATION:
      return {
        title: "Resend activation email?",
        description: `Send a new link to ${identity} at ${student.email}. Any earlier unused link will stop working.`,
        confirmLabel: "Resend activation",
        loadingLabel: "Sending",
        successTitle: "Activation email resent",
        successMessage: `A new 30-minute activation link was sent to ${student.email}.`,
      };
    case APPROVAL_ACTIONS.REVOKE:
      return {
        title: "Revoke this student approval?",
        description: `${identity} will no longer be able to activate an account. Any unused activation link will stop working.`,
        confirmLabel: "Revoke approval",
        loadingLabel: "Revoking",
        successTitle: "Student approval revoked",
        successMessage: `${student.name} can no longer activate an account.`,
        tone: "danger",
        needsReason: true,
      };
    case APPROVAL_ACTIONS.REINSTATE:
      return {
        title: "Reinstate this student approval?",
        description: `${identity} will become eligible to receive a new activation email.`,
        confirmLabel: "Reinstate approval",
        loadingLabel: "Reinstating",
        successTitle: "Student approval reinstated",
        successMessage: `${student.name} can receive an activation email again.`,
        needsReason: true,
      };
    default:
      return null;
  }
};

const getLifecycleDetail = (student) => {
  switch (student.status) {
    case APPROVAL_STATUSES.ACTIVATION_PENDING:
      return `Expires ${formatApprovalDate(student.activationExpiresAt)}`;
    case APPROVAL_STATUSES.ACTIVATION_EXPIRED:
      return `Expired ${formatApprovalDate(student.activationExpiresAt)}`;
    case APPROVAL_STATUSES.ACTIVATED:
      return `Activated ${formatApprovalDate(student.activatedAt)}`;
    case APPROVAL_STATUSES.REVOKED:
      return `Revoked ${formatApprovalDate(student.revokedAt)}`;
    default:
      return "Activation email not sent";
  }
};

const ApprovalActions = ({ student, disabled, onSelect }) => {
  const actions = getApprovalActions(student.status);

  if (actions.length === 0) {
    return <span className="hm-approvals__no-action">Account active</span>;
  }

  return (
    <div className="hm-approvals__actions">
      {actions.map((action) => (
        <Button
          key={action}
          variant={
            action === APPROVAL_ACTIONS.REVOKE
              ? "danger-secondary"
              : action === APPROVAL_ACTIONS.REINSTATE
                ? "secondary"
                : "quiet"
          }
          disabled={disabled}
          leadingIcon={getActionIcon(action)}
          aria-label={`${actionLabels[action]} for ${student.name}`}
          onClick={() => onSelect(action, student)}
        >
          {actionLabels[action]}
        </Button>
      ))}
    </div>
  );
};

const ApprovedStudents = () => {
  const [students, setStudents] = useState([]);
  const [pagination, setPagination] = useState(EMPTY_PAGINATION);
  const [recordsLoading, setRecordsLoading] = useState(true);
  const [recordsError, setRecordsError] = useState("");
  const [hostels, setHostels] = useState([]);
  const [hostelsLoading, setHostelsLoading] = useState(true);
  const [hostelsError, setHostelsError] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [hostelFilter, setHostelFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [recordsVersion, setRecordsVersion] = useState(0);
  const [approvalDialogOpen, setApprovalDialogOpen] = useState(false);
  const [approvalForm, setApprovalForm] = useState(EMPTY_FORM);
  const [approvalErrors, setApprovalErrors] = useState({});
  const [approvalError, setApprovalError] = useState("");
  const [approvalSaving, setApprovalSaving] = useState(false);
  const [actionDialog, setActionDialog] = useState(null);
  const [actionReason, setActionReason] = useState("");
  const [actionReasonError, setActionReasonError] = useState("");
  const [actionError, setActionError] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const latestRequest = useRef(0);
  const nameRef = useRef(null);
  const emailRef = useRef(null);
  const rollNoRef = useRef(null);
  const hostelRef = useRef(null);
  const { showToast } = useToast();

  const loadHostels = useCallback(async () => {
    try {
      setHostelsLoading(true);
      setHostelsError("");
      const response = await api.get("/api/admin/hostels");
      setHostels(Array.isArray(response.data?.data) ? response.data.data : []);
    } catch (error) {
      setHostelsError(
        getApiErrorMessage(error, "Hostel choices could not be loaded.")
      );
    } finally {
      setHostelsLoading(false);
    }
  }, []);

  const loadApprovedStudents = useCallback(
    async ({ showLoading = true } = {}) => {
      const requestNumber = latestRequest.current + 1;
      latestRequest.current = requestNumber;

      try {
        if (showLoading) {
          setRecordsLoading(true);
        }
        setRecordsError("");
        const response = await api.get("/api/admin/students/approvals", {
          params: {
            page,
            pageSize: EMPTY_PAGINATION.pageSize,
            search: search || undefined,
            hostelCode: hostelFilter || undefined,
            status: statusFilter || undefined,
          },
        });

        if (requestNumber !== latestRequest.current) {
          return;
        }

        const nextPagination = response.data?.pagination ?? EMPTY_PAGINATION;
        setStudents(Array.isArray(response.data?.data) ? response.data.data : []);
        setPagination(nextPagination);

        if (nextPagination.totalPages > 0 && page > nextPagination.totalPages) {
          setPage(nextPagination.totalPages);
        }
      } catch (error) {
        if (requestNumber === latestRequest.current) {
          setRecordsError(
            getApiErrorMessage(
              error,
              "Approved student records could not be loaded."
            )
          );
        }
      } finally {
        if (showLoading && requestNumber === latestRequest.current) {
          setRecordsLoading(false);
        }
      }
    },
    [hostelFilter, page, search, statusFilter]
  );

  useEffect(() => {
    loadHostels();
  }, [loadHostels]);

  useEffect(() => {
    loadApprovedStudents();
  }, [loadApprovedStudents, recordsVersion]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPage(1);
      setSearch(searchInput.trim());
    }, 350);

    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const focusFirstFormError = (errors) => {
    const fieldRefs = {
      name: nameRef,
      email: emailRef,
      rollNo: rollNoRef,
      hostelCode: hostelRef,
    };
    const firstField = ["name", "email", "rollNo", "hostelCode"].find(
      (field) => errors[field]
    );

    if (firstField) {
      window.requestAnimationFrame(() => fieldRefs[firstField].current?.focus());
    }
  };

  const closeApprovalDialog = () => {
    if (approvalSaving) {
      return;
    }

    setApprovalDialogOpen(false);
    setApprovalForm(EMPTY_FORM);
    setApprovalErrors({});
    setApprovalError("");
  };

  const updateApprovalField = (field, value) => {
    setApprovalForm((current) => ({ ...current, [field]: value }));
    setApprovalErrors((current) => ({ ...current, [field]: "" }));
    setApprovalError("");
  };

  const createStudentApproval = async (event) => {
    event.preventDefault();
    const hostelCodes = new Set(hostels.map((hostel) => hostel.code));
    const clientErrors = validateApprovalForm(approvalForm, hostelCodes);

    if (Object.keys(clientErrors).length > 0) {
      setApprovalErrors(clientErrors);
      focusFirstFormError(clientErrors);
      return;
    }

    try {
      setApprovalSaving(true);
      setApprovalError("");
      await api.post("/api/admin/students/approvals", {
        name: approvalForm.name.trim(),
        email: approvalForm.email.trim(),
        rollNo: approvalForm.rollNo.trim().replace(/\s+/g, " ").toUpperCase(),
        hostelCode: approvalForm.hostelCode,
      });
      setApprovalDialogOpen(false);
      setApprovalForm(EMPTY_FORM);
      setApprovalErrors({});
      setSearchInput("");
      setSearch("");
      setHostelFilter("");
      setStatusFilter("");
      setPage(1);
      showToast({
        tone: "success",
        title: "Student approved",
        message: "The student can now receive an account activation email.",
      });
      setRecordsVersion((current) => current + 1);
    } catch (error) {
      const fieldErrors = getServerFieldErrors(error);
      setApprovalErrors(fieldErrors);
      setApprovalError(
        getApiErrorMessage(error, "The student approval could not be created.")
      );
      focusFirstFormError(fieldErrors);
    } finally {
      setApprovalSaving(false);
    }
  };

  const openActionDialog = (action, student) => {
    setActionDialog({ action, student });
    setActionReason("");
    setActionReasonError("");
    setActionError("");
  };

  const closeActionDialog = () => {
    if (actionLoading) {
      return;
    }

    setActionDialog(null);
    setActionReason("");
    setActionReasonError("");
    setActionError("");
  };

  const confirmStudentAction = async () => {
    if (!actionDialog) {
      return;
    }

    const { action, student } = actionDialog;
    const copy = getActionCopy(action, student);
    const reason = actionReason.trim();

    if (copy.needsReason && reason.length < 5) {
      setActionReasonError("Enter at least 5 characters for the audit record.");
      return;
    }

    try {
      setActionLoading(true);
      setActionError("");

      if (
        action === APPROVAL_ACTIONS.SEND_ACTIVATION ||
        action === APPROVAL_ACTIONS.RESEND_ACTIVATION
      ) {
        await api.post(
          `/api/admin/students/approvals/${student.id}/activation-email`
        );
      } else if (action === APPROVAL_ACTIONS.REVOKE) {
        await api.patch(
          `/api/admin/students/approvals/${student.id}/revoke`,
          { reason }
        );
      } else if (action === APPROVAL_ACTIONS.REINSTATE) {
        await api.patch(
          `/api/admin/students/approvals/${student.id}/reinstate`,
          { reason }
        );
      }

      setActionDialog(null);
      setActionReason("");
      showToast({
        tone: "success",
        title: copy.successTitle,
        message: copy.successMessage,
      });
      await loadApprovedStudents({ showLoading: false });
    } catch (error) {
      setActionError(
        getApiErrorMessage(error, "The student record could not be updated.")
      );
    } finally {
      setActionLoading(false);
    }
  };

  const clearFilters = () => {
    setSearchInput("");
    setSearch("");
    setHostelFilter("");
    setStatusFilter("");
    setPage(1);
  };

  const filtersActive = Boolean(search || hostelFilter || statusFilter);
  const approvalDisabled =
    hostelsLoading || Boolean(hostelsError) || hostels.length === 0;
  const firstResult =
    pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.pageSize + 1;
  const lastResult = Math.min(
    pagination.page * pagination.pageSize,
    pagination.total
  );
  const actionCopy = actionDialog
    ? getActionCopy(actionDialog.action, actionDialog.student)
    : null;

  return (
    <div className="hm-page-stack hm-page-stack--wide hm-approvals">
      <PageHeader
        eyebrow="Accounts and roles"
        title="Student onboarding"
        description="Approve institutional identities, assign a hostel, and manage account activation eligibility."
        actions={
          <Button
            variant="primary"
            size="form"
            leadingIcon={<UserPlus aria-hidden="true" />}
            disabled={approvalDisabled}
            onClick={() => setApprovalDialogOpen(true)}
          >
            Approve student
          </Button>
        }
      />

      {hostelsError && (
        <div className="hm-approvals__notice" role="alert">
          <div>
            <strong>Hostel choices are unavailable.</strong>
            <span>{hostelsError}</span>
          </div>
          <Button onClick={loadHostels}>Retry hostel list</Button>
        </div>
      )}

      {!hostelsLoading && !hostelsError && hostels.length === 0 && (
        <div className="hm-approvals__notice" role="status">
          <div>
            <strong>No active hostels are configured.</strong>
            <span>Add an active hostel before approving a student.</span>
          </div>
        </div>
      )}

      <Panel className="hm-approvals__filters">
        <Input
          label="Search students"
          type="search"
          placeholder="Name, email, or roll number"
          startIcon={<Search />}
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
        />
        <Select
          label="Hostel"
          value={hostelFilter}
          onChange={(event) => {
            setHostelFilter(event.target.value);
            setPage(1);
          }}
        >
          <option value="">All hostels</option>
          {hostels.map((hostel) => (
            <option key={hostel.id} value={hostel.code}>
              {hostel.code} — {hostel.name}
            </option>
          ))}
        </Select>
        <Select
          label="Status"
          value={statusFilter}
          onChange={(event) => {
            setStatusFilter(event.target.value);
            setPage(1);
          }}
        >
          {APPROVAL_STATUS_OPTIONS.map((option) => (
            <option key={option.value || "all"} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
        {searchInput && (
          <Button
            variant="quiet"
            className="hm-approvals__clear-search"
            onClick={() => {
              setSearchInput("");
              setSearch("");
              setPage(1);
            }}
          >
            Clear search
          </Button>
        )}
      </Panel>

      {recordsLoading && students.length > 0 && (
        <p className="hm-approvals__refreshing" role="status">
          Updating results…
        </p>
      )}

      {recordsError && students.length > 0 && (
        <div className="hm-approvals__notice" role="alert">
          <div>
            <strong>Results could not be refreshed.</strong>
            <span>{recordsError}</span>
          </div>
          <Button onClick={() => loadApprovedStudents()}>Try again</Button>
        </div>
      )}

      {recordsLoading && students.length === 0 ? (
        <LoadingState label="Loading approved student records" rows={5} />
      ) : recordsError && students.length === 0 ? (
        <ErrorState
          title="Approved students are unavailable"
          description={recordsError}
          onRetry={loadApprovedStudents}
        />
      ) : students.length === 0 ? (
        <EmptyState
          icon={UserCheck}
          title={filtersActive ? "No matching students" : "No approved students"}
          description={
            filtersActive
              ? "No approved-student records match the current search and filters."
              : "Approve the first student identity to begin account onboarding."
          }
          action={
            filtersActive ? (
              <Button onClick={clearFilters}>Clear filters</Button>
            ) : (
              <Button
                variant="primary"
                disabled={approvalDisabled}
                onClick={() => setApprovalDialogOpen(true)}
              >
                Approve student
              </Button>
            )
          }
        />
      ) : (
        <section className="hm-approvals__results" aria-labelledby="approval-results-title">
          <div className="hm-approvals__results-header">
            <div>
              <h2 id="approval-results-title">Approved students</h2>
              <p>
                Showing {firstResult}–{lastResult} of {pagination.total} records
              </p>
            </div>
          </div>

          <div className="hm-approvals__desktop-list">
            <Table caption="Approved student records" hideCaption>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Student</TableHeaderCell>
                  <TableHeaderCell>Hostel</TableHeaderCell>
                  <TableHeaderCell>Status</TableHeaderCell>
                  <TableHeaderCell>Activation</TableHeaderCell>
                  <TableHeaderCell>Approved</TableHeaderCell>
                  <TableHeaderCell className="hm-table__actions">
                    Actions
                  </TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {students.map((student) => (
                  <TableRow key={student.id}>
                    <TableCell>
                      <strong className="hm-approvals__student-name">
                        {student.name}
                      </strong>
                      <span className="hm-approvals__student-meta">
                        {student.email}
                      </span>
                      <span className="hm-approvals__student-meta hm-approvals__mono">
                        {student.rollNo}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="hm-approvals__hostel">
                        <Building2 aria-hidden="true" />
                        <span>
                          <strong>{student.hostel.code}</strong>
                          <small>{student.hostel.name}</small>
                        </span>
                      </span>
                    </TableCell>
                    <TableCell>
                      <StatusBadge tone={getApprovalStatusTone(student.status)}>
                        {getApprovalStatusLabel(student.status)}
                      </StatusBadge>
                    </TableCell>
                    <TableCell className="hm-approvals__date">
                      {getLifecycleDetail(student)}
                    </TableCell>
                    <TableCell className="hm-approvals__date">
                      {formatApprovalDate(student.approvedAt)}
                    </TableCell>
                    <TableCell actions>
                      <ApprovalActions
                        student={student}
                        disabled={actionLoading}
                        onSelect={openActionDialog}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="hm-approvals__mobile-list">
            {students.map((student) => (
              <Panel as="article" key={student.id} className="hm-approvals__record">
                <div className="hm-approvals__record-heading">
                  <div>
                    <h3>{student.name}</h3>
                    <p>{student.email}</p>
                  </div>
                  <StatusBadge tone={getApprovalStatusTone(student.status)}>
                    {getApprovalStatusLabel(student.status)}
                  </StatusBadge>
                </div>
                <dl className="hm-approvals__record-details">
                  <div>
                    <dt>Roll number</dt>
                    <dd className="hm-approvals__mono">{student.rollNo}</dd>
                  </div>
                  <div>
                    <dt>Hostel</dt>
                    <dd>{student.hostel.code} — {student.hostel.name}</dd>
                  </div>
                  <div>
                    <dt>Activation</dt>
                    <dd>{getLifecycleDetail(student)}</dd>
                  </div>
                  <div>
                    <dt>Approved</dt>
                    <dd>{formatApprovalDate(student.approvedAt)}</dd>
                  </div>
                </dl>
                <ApprovalActions
                  student={student}
                  disabled={actionLoading}
                  onSelect={openActionDialog}
                />
              </Panel>
            ))}
          </div>

          <nav className="hm-approvals__pagination" aria-label="Student approval pages">
            <Button
              disabled={pagination.page <= 1 || recordsLoading}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              Previous
            </Button>
            <span>
              Page {pagination.page} of {Math.max(1, pagination.totalPages)}
            </span>
            <Button
              disabled={
                pagination.totalPages === 0 ||
                pagination.page >= pagination.totalPages ||
                recordsLoading
              }
              onClick={() => setPage((current) => current + 1)}
            >
              Next
            </Button>
          </nav>
        </section>
      )}

      <Dialog
        open={approvalDialogOpen}
        title="Approve a student"
        description="Use the student's existing institutional identity. Room allocation is completed separately."
        dismissDisabled={approvalSaving}
        onDismiss={closeApprovalDialog}
        footer={
          <>
            <Button onClick={closeApprovalDialog} disabled={approvalSaving}>
              Cancel
            </Button>
            <Button
              type="submit"
              form="student-approval-form"
              variant="primary"
              loading={approvalSaving}
              loadingLabel="Approving"
            >
              Approve student
            </Button>
          </>
        }
      >
        <form
          id="student-approval-form"
          className="hm-approvals__form"
          noValidate
          onSubmit={createStudentApproval}
        >
          {approvalError && (
            <p className="hm-approvals__form-error" role="alert">
              {approvalError}
            </p>
          )}
          <Input
            ref={nameRef}
            data-autofocus
            label="Student name"
            name="name"
            autoComplete="name"
            maxLength={255}
            placeholder="Asha Rao"
            required
            value={approvalForm.name}
            error={approvalErrors.name}
            onChange={(event) => updateApprovalField("name", event.target.value)}
          />
          <Input
            ref={emailRef}
            label="Institutional email"
            name="email"
            type="email"
            autoComplete="email"
            maxLength={255}
            placeholder="asha.rao@college.edu"
            hint="HostelMate verifies this existing address; it does not create an email account."
            required
            value={approvalForm.email}
            error={approvalErrors.email}
            onChange={(event) => updateApprovalField("email", event.target.value)}
          />
          <Input
            ref={rollNoRef}
            label="Roll number"
            name="rollNo"
            maxLength={50}
            placeholder="2026-CSE-042"
            required
            value={approvalForm.rollNo}
            error={approvalErrors.rollNo}
            onChange={(event) => updateApprovalField("rollNo", event.target.value)}
          />
          <Select
            ref={hostelRef}
            label="Assigned hostel"
            name="hostelCode"
            required
            value={approvalForm.hostelCode}
            error={approvalErrors.hostelCode}
            onChange={(event) =>
              updateApprovalField("hostelCode", event.target.value)
            }
          >
            <option value="">Select a hostel</option>
            {hostels.map((hostel) => (
              <option key={hostel.id} value={hostel.code}>
                {hostel.code} — {hostel.name}
              </option>
            ))}
          </Select>
        </form>
      </Dialog>

      <ConfirmationDialog
        open={Boolean(actionDialog)}
        title={actionCopy?.title ?? "Confirm student action"}
        description={actionCopy?.description}
        confirmLabel={actionCopy?.confirmLabel}
        loadingLabel={actionCopy?.loadingLabel}
        tone={actionCopy?.tone}
        loading={actionLoading}
        onConfirm={confirmStudentAction}
        onDismiss={closeActionDialog}
      >
        {actionCopy?.needsReason && (
          <Textarea
            data-autofocus
            label="Reason"
            name="reason"
            maxLength={500}
            placeholder="Explain why this approval is changing"
            hint="Saved in the immutable audit record."
            required
            value={actionReason}
            error={actionReasonError}
            onChange={(event) => {
              setActionReason(event.target.value);
              setActionReasonError("");
              setActionError("");
            }}
          />
        )}
        {actionError && (
          <p className="hm-approvals__form-error" role="alert">
            {actionError}
          </p>
        )}
      </ConfirmationDialog>
    </div>
  );
};

export default ApprovedStudents;
