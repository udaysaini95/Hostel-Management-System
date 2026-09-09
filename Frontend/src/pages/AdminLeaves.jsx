import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Search, ShieldCheck } from "lucide-react";
import { getApiErrorMessage } from "../api/errors.js";
import {
  Badge,
  Button,
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
} from "../components/ui/index.js";
import { useToast } from "../feedback/toastContext.js";
import { LeaveDecisionDialog } from "../leave/LeaveDecisionDialog.jsx";
import { listLeaveReviewQueue } from "../leave/leaveReviewApi.js";
import {
  formatLeaveDateTime,
  getLeaveStatusLabel,
} from "../leave/leaveView.js";
import {
  formatLeaveRange,
  getReviewWarning,
} from "../leave/leaveReviewView.js";
import { PaginationControls } from "../residents/PaginationControls.jsx";

const EMPTY_PAGINATION = Object.freeze({
  page: 1,
  pageSize: 15,
  total: 0,
  totalPages: 0,
});

const statusOptions = Object.freeze([
  ["pending", "Pending review"],
  ["all", "All statuses"],
  ["approved", "Approved"],
  ["rejected", "Rejected"],
  ["exited", "Currently outside"],
  ["returned", "Returned"],
  ["expired", "Expired"],
]);

const LeaveActions = ({ leave, onReview }) => {
  if (leave.status !== "pending") {
    return <span className="hm-leave-review__decided">Decision recorded</span>;
  }

  const approvalBlocked = getReviewWarning(leave)?.blocksApproval;

  return (
    <div className="hm-leave-review__actions">
      <Button
        variant="primary"
        disabled={approvalBlocked}
        onClick={() => onReview(leave, "approved")}
      >
        Approve
      </Button>
      <Button
        variant="danger"
        onClick={() => onReview(leave, "rejected")}
      >
        Reject
      </Button>
    </div>
  );
};

const AdminLeaves = () => {
  const [leaves, setLeaves] = useState([]);
  const [pagination, setPagination] = useState(EMPTY_PAGINATION);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("pending");
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [review, setReview] = useState(null);
  const { showToast } = useToast();

  const loadQueue = useCallback(async ({ showLoading = true } = {}) => {
    try {
      if (showLoading) setLoading(true);
      setLoadError("");
      const result = await listLeaveReviewQueue({
        page,
        pageSize: 15,
        status,
        ...(search ? { search } : {}),
      });
      setLeaves(result?.data ?? []);
      setPagination(result?.pagination ?? EMPTY_PAGINATION);
    } catch (error) {
      setLoadError(
        getApiErrorMessage(
          error,
          "The leave review queue could not be loaded."
        )
      );
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [page, search, status]);

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  const submitFilters = (event) => {
    event.preventDefault();
    setPage(1);
    setSearch(searchDraft.trim());
  };

  const resetFilters = () => {
    setSearchDraft("");
    setSearch("");
    setStatus("pending");
    setPage(1);
  };

  const openReview = (leave, outcome) => setReview({ leave, outcome });

  const finishDecision = async (result) => {
    const outcome = result.leaveRequest.status;
    setReview(null);
    showToast({
      tone: "success",
      title: outcome === "approved" ? "Leave approved" : "Leave rejected",
      message:
        outcome === "approved"
          ? "A private gate pass is now available to the student."
          : "The decision note is now visible in the request history.",
    });
    await loadQueue({ showLoading: false });
  };

  return (
    <div className="hm-page-stack hm-page-stack--wide hm-leave-review">
      <PageHeader
        eyebrow="Leave operations"
        title="Leave review queue"
        description="Review requests from students in your assigned hostels and record an auditable decision."
      />

      <Panel
        as="form"
        className="hm-leave-review__filters"
        onSubmit={submitFilters}
      >
        <Input
          label="Search requests"
          placeholder="Student, roll number, email, or reason"
          maxLength={100}
          startIcon={<Search />}
          value={searchDraft}
          onChange={(event) => setSearchDraft(event.target.value)}
        />
        <Select
          label="Request status"
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            setPage(1);
          }}
        >
          {statusOptions.map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </Select>
        <div className="hm-leave-review__filter-actions">
          <Button type="submit" variant="primary">Search</Button>
          <Button onClick={resetFilters}>Reset</Button>
        </div>
      </Panel>

      {loading ? (
        <LoadingState label="Loading leave review queue" rows={5} />
      ) : loadError ? (
        <ErrorState
          title="Leave review queue unavailable"
          description={loadError}
          onRetry={loadQueue}
        />
      ) : leaves.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title={
            status === "pending" && !search
              ? "No requests awaiting review"
              : "No matching leave requests"
          }
          description={
            status === "pending" && !search
              ? "New student leave requests will appear here."
              : "Adjust the status or search terms to find another request."
          }
        />
      ) : (
        <Panel padding="none" className="hm-leave-review__results">
          <Table
            caption="Student leave requests"
            hideCaption
            wrapperClassName="hm-leave-review__table"
          >
            <TableHead>
              <TableRow>
                <TableHeaderCell>Student</TableHeaderCell>
                <TableHeaderCell>Leave details</TableHeaderCell>
                <TableHeaderCell>Hostel and room</TableHeaderCell>
                <TableHeaderCell>Status</TableHeaderCell>
                <TableHeaderCell className="hm-table__actions">
                  Actions
                </TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {leaves.map((leave) => {
                const warning = getReviewWarning(leave);
                return (
                  <TableRow key={leave.id}>
                    <TableCell>
                      <strong className="hm-leave-review__student-name">
                        {leave.student.name}
                      </strong>
                      <span className="hm-leave-review__muted">
                        {leave.student.rollNo}
                      </span>
                      <span className="hm-leave-review__muted">
                        Submitted {formatLeaveDateTime(leave.createdAt)}
                      </span>
                      {leave.isEmergency && (
                        <Badge tone="danger">Emergency</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="hm-leave-review__range">
                        {formatLeaveRange(leave)}
                      </span>
                      <span className="hm-leave-review__reason">
                        {leave.reason}
                      </span>
                      {warning && (
                        <span
                          className={`hm-leave-review__inline-warning hm-leave-review__inline-warning--${warning.tone}`}
                        >
                          {warning.title}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <strong>{leave.hostel.code}</strong>
                      <span className="hm-leave-review__muted">
                        {leave.hostel.name}
                      </span>
                      <span className="hm-leave-review__room">
                        {leave.room?.label ?? "Room unavailable"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={leave.status}>
                        {getLeaveStatusLabel(leave.status)}
                      </StatusBadge>
                      {leave.decision && (
                        <span className="hm-leave-review__decision-note">
                          {leave.decision.note}
                        </span>
                      )}
                    </TableCell>
                    <TableCell actions>
                      <LeaveActions leave={leave} onReview={openReview} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          <div className="hm-leave-review__mobile-list">
            {leaves.map((leave) => {
              const warning = getReviewWarning(leave);
              return (
                <article
                  key={leave.id}
                  className="hm-leave-review__mobile-record"
                >
                  <div className="hm-leave-review__mobile-heading">
                    <div>
                      <strong>{leave.student.name}</strong>
                      <span>
                        {leave.student.rollNo} · {leave.room?.label ?? "No room"}
                      </span>
                    </div>
                    <StatusBadge status={leave.status}>
                      {getLeaveStatusLabel(leave.status)}
                    </StatusBadge>
                  </div>
                  <p className="hm-leave-review__range">
                    {formatLeaveRange(leave)}
                  </p>
                  <p className="hm-leave-review__reason">{leave.reason}</p>
                  <div className="hm-leave-review__mobile-meta">
                    <span>{leave.hostel.code}</span>
                    <span>Submitted {formatLeaveDateTime(leave.createdAt)}</span>
                    {leave.isEmergency && (
                      <Badge tone="danger">Emergency</Badge>
                    )}
                  </div>
                  {warning && (
                    <div
                      className={`hm-leave-review__warning hm-leave-review__warning--${warning.tone}`}
                    >
                      <ShieldCheck aria-hidden="true" />
                      <div>
                        <strong>{warning.title}</strong>
                        <span>{warning.message}</span>
                      </div>
                    </div>
                  )}
                  {leave.decision && (
                    <p className="hm-leave-review__decision-note">
                      Decision note: {leave.decision.note}
                    </p>
                  )}
                  <LeaveActions leave={leave} onReview={openReview} />
                </article>
              );
            })}
          </div>

          <PaginationControls
            pagination={pagination}
            onPageChange={setPage}
            disabled={loading}
            label="Leave review pages"
          />
        </Panel>
      )}

      <LeaveDecisionDialog
        review={review}
        onDismiss={() => setReview(null)}
        onDecided={finishDecision}
      />
    </div>
  );
};

export default AdminLeaves;
