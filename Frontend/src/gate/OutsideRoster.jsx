import { ClockAlert, Search, Users } from "lucide-react";
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  Input,
  LoadingState,
  Panel,
  Select,
} from "../components/ui/index.js";
import { formatLeaveDateTime } from "../leave/leaveView.js";
import { PaginationControls } from "../residents/PaginationControls.jsx";
import { getRoomLabel } from "./gateView.js";

export const OutsideRoster = ({
  records,
  pagination,
  generatedAt,
  loading,
  refreshing,
  error,
  searchDraft,
  overdue,
  onSearchDraftChange,
  onOverdueChange,
  onSubmit,
  onRetry,
  onPageChange,
}) => (
  <section className="hm-gate-section" aria-labelledby="outside-roster-title">
    <div className="hm-gate-section__heading">
      <div>
        <h2 id="outside-roster-title">Students outside campus</h2>
        <p>
          Live hostel roster{generatedAt
            ? ` · Updated ${formatLeaveDateTime(generatedAt)}`
            : ""}
        </p>
      </div>
      {refreshing && <span className="hm-gate-section__sync">Refreshing…</span>}
    </div>

    <Panel as="form" className="hm-gate-section__filters" onSubmit={onSubmit}>
      <Input
        label="Search outside roster"
        placeholder="Student, roll number, or room"
        maxLength={100}
        startIcon={<Search />}
        value={searchDraft}
        onChange={(event) => onSearchDraftChange(event.target.value)}
      />
      <Select
        label="Return status"
        value={overdue}
        onChange={(event) => onOverdueChange(event.target.value)}
      >
        <option value="all">All outside students</option>
        <option value="overdue">Overdue only</option>
        <option value="on-time">Within return time</option>
      </Select>
      <Button type="submit">Apply</Button>
    </Panel>

    {loading ? (
      <LoadingState label="Loading outside-campus roster" rows={3} />
    ) : error && records.length === 0 ? (
      <ErrorState
        title="Outside roster unavailable"
        description={error}
        onRetry={onRetry}
      />
    ) : records.length === 0 ? (
      <EmptyState
        icon={Users}
        title="No students match this roster"
        description="Everyone in the selected hostel scope is currently accounted for."
      />
    ) : (
      <Panel padding="none" className="hm-gate-list-panel">
        {error && (
          <div className="hm-gate-section__stale" role="status">
            Live refresh failed. Showing the most recent roster.
            <Button variant="quiet" onClick={onRetry}>Retry</Button>
          </div>
        )}
        <ul className="hm-gate-roster">
          {records.map((record) => (
            <li key={record.leaveRequestId}>
              <div className="hm-gate-roster__identity">
                <strong>{record.student.name}</strong>
                <span>{record.student.rollNo} · {getRoomLabel(record.student.room)}</span>
              </div>
              <div>
                <span>Departed</span>
                <strong>{formatLeaveDateTime(record.departedAt)}</strong>
              </div>
              <div>
                <span>Expected return</span>
                <strong>{formatLeaveDateTime(record.expectedReturnAt)}</strong>
              </div>
              <div className="hm-gate-roster__status">
                {record.overdue ? (
                  <Badge tone="danger"><ClockAlert aria-hidden="true" /> Overdue</Badge>
                ) : (
                  <Badge tone="info">Outside</Badge>
                )}
                <span>{record.hostel.code}</span>
              </div>
            </li>
          ))}
        </ul>
        <PaginationControls
          pagination={pagination}
          onPageChange={onPageChange}
          disabled={loading}
          label="Outside roster pages"
        />
      </Panel>
    )}
  </section>
);
