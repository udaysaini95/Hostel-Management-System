import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarClock, FileText, Plus } from "lucide-react";
import {
  ButtonLink,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  Panel,
  Select,
  Badge,
  StatusBadge,
} from "../components/ui/index.js";
import { getApiErrorMessage } from "../api/errors.js";
import { ActiveGatePass } from "../leave/ActiveGatePass.jsx";
import { listMyLeaveRequests } from "../leave/leaveApi.js";
import {
  findCurrentGatePass,
  formatLeaveDateTime,
  getLeaveDisplayStatus,
  getLeaveStatusDescription,
  getLeaveStatusLabel,
} from "../leave/leaveView.js";
import { PaginationControls } from "../residents/PaginationControls.jsx";

const EMPTY_PAGINATION = Object.freeze({
  page: 1,
  pageSize: 10,
  total: 0,
  totalPages: 0,
});

const statusOptions = Object.freeze([
  ["", "All statuses"],
  ["pending", "Pending review"],
  ["approved", "Approved"],
  ["exited", "Currently outside"],
  ["returned", "Returned"],
  ["rejected", "Rejected"],
  ["expired", "Expired"],
]);

const MyLeaves = () => {
  const [leaves, setLeaves] = useState([]);
  const [pagination, setPagination] = useState(EMPTY_PAGINATION);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const loadLeaves = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError("");
      const result = await listMyLeaveRequests({
        page,
        pageSize: 10,
        ...(status ? { status } : {}),
      });
      setLeaves(result?.data ?? []);
      setPagination(result?.pagination ?? EMPTY_PAGINATION);
    } catch (error) {
      setLoadError(
        getApiErrorMessage(error, "Your leave requests could not be loaded.")
      );
    } finally {
      setLoading(false);
    }
  }, [page, status]);

  useEffect(() => {
    loadLeaves();
  }, [loadLeaves]);

  const currentPass = useMemo(
    () => (status || page !== 1 ? null : findCurrentGatePass(leaves)),
    [leaves, page, status]
  );

  const updateStatus = (event) => {
    setStatus(event.target.value);
    setPage(1);
  };

  return (
    <div className="hm-page-stack hm-page-stack--wide hm-leave-page">
      <PageHeader
        eyebrow="Resident self-service"
        title="Leave and gate pass"
        description="Apply for leave, follow each decision, and access your current private gate pass."
        actions={
          <ButtonLink
            to="/student/leaves/apply"
            variant="primary"
          >
            <Plus aria-hidden="true" /> Apply for leave
          </ButtonLink>
        }
      />

      {!loading && !loadError && currentPass && (
        <ActiveGatePass leave={currentPass} />
      )}

      <section className="hm-leave-history" aria-labelledby="leave-history-title">
        <div className="hm-leave-history__heading">
          <div>
            <h2 id="leave-history-title">My leave requests</h2>
            <p>Newest requests appear first.</p>
          </div>
          <Select
            label="Filter by status"
            value={status}
            onChange={updateStatus}
          >
            {statusOptions.map(([value, label]) => (
              <option value={value} key={value || "all"}>{label}</option>
            ))}
          </Select>
        </div>

        {loading ? (
          <LoadingState label="Loading your leave requests" rows={4} />
        ) : loadError ? (
          <ErrorState
            title="Leave requests unavailable"
            description={loadError}
            onRetry={loadLeaves}
          />
        ) : leaves.length === 0 ? (
          <EmptyState
            icon={FileText}
            title={status ? "No requests match this status" : "No leave requests yet"}
            description={
              status
                ? "Choose another status to see your other leave requests."
                : "Apply for leave when you need permission to leave the hostel."
            }
            action={!status && (
              <ButtonLink to="/student/leaves/apply" variant="primary">
                Apply for leave
              </ButtonLink>
            )}
          />
        ) : (
          <Panel padding="none" className="hm-leave-history__panel">
            <ul className="hm-leave-history__list">
              {leaves.map((leave) => {
                const displayStatus = getLeaveDisplayStatus(leave);
                return (
                  <li key={leave.id} className="hm-leave-history__row">
                    <div className="hm-leave-history__icon" aria-hidden="true">
                      <CalendarClock />
                    </div>
                    <div className="hm-leave-history__main">
                      <div className="hm-leave-history__title-row">
                        <strong>{leave.reason}</strong>
                        <StatusBadge status={displayStatus}>
                          {getLeaveStatusLabel(displayStatus)}
                        </StatusBadge>
                      </div>
                      <p className="hm-leave-history__dates">
                        {formatLeaveDateTime(leave.departureAt)} – {formatLeaveDateTime(leave.expectedReturnAt)}
                      </p>
                      <p className="hm-leave-history__status-copy">
                        {getLeaveStatusDescription(displayStatus)}
                      </p>
                    </div>
                    <div className="hm-leave-history__context">
                      {leave.isEmergency && (
                        <Badge tone="danger">Emergency</Badge>
                      )}
                      <span>{leave.hostel.code}</span>
                      <span>{leave.room ? `${leave.room.blockCode}-${leave.room.roomNumber}` : "Room unavailable"}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
            <PaginationControls
              pagination={pagination}
              onPageChange={setPage}
              disabled={loading}
              label="Leave request pages"
            />
          </Panel>
        )}
      </section>
    </div>
  );
};

export default MyLeaves;
