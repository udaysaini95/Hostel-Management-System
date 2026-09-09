import { History, Search } from "lucide-react";
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
import { getMovementLabel, getRoomLabel } from "./gateView.js";

export const MovementHistory = ({
  records,
  pagination,
  loading,
  error,
  searchDraft,
  movement,
  verificationType,
  onSearchDraftChange,
  onMovementChange,
  onVerificationTypeChange,
  onSubmit,
  onRetry,
  onPageChange,
}) => (
  <section className="hm-gate-section" aria-labelledby="movement-history-title">
    <div className="hm-gate-section__heading">
      <div>
        <h2 id="movement-history-title">Recent gate movements</h2>
        <p>Audited exit, return, and exceptional movement records.</p>
      </div>
    </div>

    <Panel as="form" className="hm-gate-history__filters" onSubmit={onSubmit}>
      <Input
        label="Search movements"
        placeholder="Student, roll number, or room"
        maxLength={100}
        startIcon={<Search />}
        value={searchDraft}
        onChange={(event) => onSearchDraftChange(event.target.value)}
      />
      <Select
        label="Movement"
        value={movement}
        onChange={(event) => onMovementChange(event.target.value)}
      >
        <option value="all">Exit and return</option>
        <option value="exit">Exit only</option>
        <option value="return">Return only</option>
      </Select>
      <Select
        label="Verification"
        value={verificationType}
        onChange={(event) => onVerificationTypeChange(event.target.value)}
      >
        <option value="all">All records</option>
        <option value="standard">Verified passes</option>
        <option value="override">Overrides only</option>
      </Select>
      <Button type="submit">Apply</Button>
    </Panel>

    {loading ? (
      <LoadingState label="Loading recent gate movements" rows={4} />
    ) : error ? (
      <ErrorState
        title="Movement history unavailable"
        description={error}
        onRetry={onRetry}
      />
    ) : records.length === 0 ? (
      <EmptyState
        icon={History}
        title="No matching gate movements"
        description="Recorded exits and returns will appear here."
      />
    ) : (
      <Panel padding="none" className="hm-gate-list-panel">
        <ul className="hm-gate-history">
          {records.map((record) => (
            <li key={record.id}>
              <div className="hm-gate-history__movement">
                <Badge tone={record.movement === "exit" ? "warning" : "success"}>
                  {getMovementLabel(record.movement)}
                </Badge>
                {record.isOverride && <Badge tone="danger">Override</Badge>}
              </div>
              <div>
                <strong>{record.student.name}</strong>
                <span>{record.student.rollNo} · {getRoomLabel(record.student.room)}</span>
              </div>
              <div>
                <strong>{formatLeaveDateTime(record.occurredAt)}</strong>
                <span>{record.hostel.code}</span>
              </div>
              <div>
                <strong>{record.actor.name}</strong>
                <span>{record.actor.role} · {record.verificationMethod}</span>
              </div>
            </li>
          ))}
        </ul>
        <PaginationControls
          pagination={pagination}
          onPageChange={onPageChange}
          disabled={loading}
          label="Gate movement pages"
        />
      </Panel>
    )}
  </section>
);
