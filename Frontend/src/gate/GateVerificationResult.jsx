import { CheckCircle2, ShieldAlert } from "lucide-react";
import { Badge, Button, Panel } from "../components/ui/index.js";
import { formatLeaveDateTime } from "../leave/leaveView.js";
import {
  getGateActionLabel,
  getRoomLabel,
  getVerificationTitle,
} from "./gateView.js";

export const GateVerificationResult = ({
  verification,
  movement,
  actionError,
  recording,
  onRecord,
}) => {
  if (!verification) return null;

  const details = verification.details;
  const valid = verification.valid;
  const action = verification.permittedAction;

  return (
    <Panel
      className={`hm-gate-result hm-gate-result--${valid ? "valid" : "invalid"}`}
      aria-live="polite"
    >
      <div className="hm-gate-result__heading">
        <div className="hm-gate-result__state">
          {valid
            ? <CheckCircle2 aria-hidden="true" />
            : <ShieldAlert aria-hidden="true" />}
          <div>
            <h2>{movement ? "Gate movement recorded" : getVerificationTitle(verification)}</h2>
            <p>
              {movement
                ? `${getGateActionLabel(movement.movement)} completed successfully.`
                : verification.message}
            </p>
          </div>
        </div>
        <Badge tone={valid ? "success" : "danger"}>
          {movement ? "Completed" : valid ? "Valid pass" : "Action denied"}
        </Badge>
      </div>

      {details && (
        <dl className="hm-gate-result__identity">
          <div>
            <dt>Student</dt>
            <dd>{details.student.name}</dd>
          </div>
          <div>
            <dt>Roll number</dt>
            <dd>{details.student.rollNo}</dd>
          </div>
          <div>
            <dt>Hostel and room</dt>
            <dd>{details.hostel.code} · {getRoomLabel(details.student.room)}</dd>
          </div>
          <div>
            <dt>Valid from</dt>
            <dd>{formatLeaveDateTime(details.pass.validFrom)}</dd>
          </div>
          <div>
            <dt>Valid until</dt>
            <dd>{formatLeaveDateTime(details.pass.expiresAt)}</dd>
          </div>
        </dl>
      )}

      {movement ? (
        <div className="hm-gate-result__completion" role="status">
          <CheckCircle2 aria-hidden="true" />
          <span>
            Recorded at {formatLeaveDateTime(movement.occurredAt)} by the
            authenticated gate officer{movement.replayed ? " (confirmed retry)" : ""}.
          </span>
        </div>
      ) : action ? (
        <div className="hm-gate-result__action">
          <p>The server permits one action for this pass.</p>
          {actionError && <p className="hm-gate-result__action-error" role="alert">{actionError}</p>}
          <Button
            variant="primary"
            size="touch"
            loading={recording}
            loadingLabel={`Recording ${action}`}
            onClick={() => onRecord(action)}
          >
            {getGateActionLabel(action)}
          </Button>
        </div>
      ) : null}
    </Panel>
  );
};
