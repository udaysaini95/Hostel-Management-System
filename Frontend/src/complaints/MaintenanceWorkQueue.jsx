import { Clock3, MapPin, UserRound } from "lucide-react";
import { Badge, Button, StatusBadge } from "../components/ui/index.js";
import {
  formatComplaintDate,
  getComplaintPriorityLabel,
  getComplaintPriorityTone,
  getComplaintStatusLabel,
  getSlaPresentation,
} from "./complaintView.js";

const WorkOrderActions = ({ complaint, onOpen, onResolve, onStart }) => (
  <div className="hm-work-order__actions">
    {complaint.status === "assigned" && (
      <Button variant="primary" onClick={() => onStart(complaint)}>
        Start work
      </Button>
    )}
    {complaint.status === "in_progress" && (
      <Button variant="primary" onClick={() => onResolve(complaint)}>
        Resolve
      </Button>
    )}
    <Button onClick={() => onOpen(complaint.id)}>View details</Button>
  </div>
);

export const MaintenanceWorkQueue = ({
  complaints,
  onOpen,
  onResolve,
  onStart,
}) => (
  <ul className="hm-work-order-list" aria-label="Assigned maintenance work">
    {complaints.map((complaint) => {
      const sla = getSlaPresentation(complaint.sla);

      return (
        <li key={complaint.id} className="hm-work-order">
          <div className="hm-work-order__main">
            <button
              type="button"
              className="hm-work-order__title"
              onClick={() => onOpen(complaint.id)}
            >
              <span>Complaint #{complaint.id}</span>
              <strong>{complaint.category.name}</strong>
            </button>

            <div className="hm-work-order__badges">
              <StatusBadge status={complaint.status}>
                {getComplaintStatusLabel(complaint.status)}
              </StatusBadge>
              <Badge tone={getComplaintPriorityTone(complaint.priority)}>
                {getComplaintPriorityLabel(complaint.priority)} priority
              </Badge>
              <Badge tone={sla.tone}>{sla.label}</Badge>
            </div>

            <p className="hm-work-order__description">{complaint.description}</p>

            <div className="hm-work-order__meta">
              <span>
                <MapPin aria-hidden="true" />
                {complaint.hostel.code} · {complaint.room?.label ?? complaint.location}
              </span>
              <span>
                <UserRound aria-hidden="true" />
                {complaint.reportedBy.name}
              </span>
              <span>
                <Clock3 aria-hidden="true" />
                Updated {formatComplaintDate(complaint.updatedAt)}
              </span>
            </div>
          </div>

          <WorkOrderActions
            complaint={complaint}
            onOpen={onOpen}
            onResolve={onResolve}
            onStart={onStart}
          />
        </li>
      );
    })}
  </ul>
);
