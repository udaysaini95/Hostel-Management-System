import { ChevronRight, Clock3, MapPin } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge, StatusBadge } from "../components/ui/index.js";
import {
  formatComplaintDate,
  getComplaintPriorityLabel,
  getComplaintPriorityTone,
  getComplaintStatusLabel,
  getSlaPresentation,
} from "./complaintView.js";

export const ComplaintListItem = ({ complaint }) => {
  const sla = getSlaPresentation(complaint.sla);
  const location = complaint.room?.label ?? complaint.location;

  return (
    <li className="hm-complaint-list__item">
      <div className="hm-complaint-list__main">
        <div className="hm-complaint-list__heading">
          <div>
            <span className="hm-complaint-list__category">
              {complaint.category.name}
            </span>
            <h2>Complaint #{complaint.id}</h2>
          </div>
          <StatusBadge status={complaint.status}>
            {getComplaintStatusLabel(complaint.status)}
          </StatusBadge>
        </div>

        <p className="hm-complaint-list__description">
          {complaint.description}
        </p>

        <div className="hm-complaint-list__meta">
          <span>
            <MapPin aria-hidden="true" />
            {location}
          </span>
          <Badge tone={getComplaintPriorityTone(complaint.priority)}>
            {getComplaintPriorityLabel(complaint.priority)} priority
          </Badge>
          <Badge tone={sla.tone}>{sla.label}</Badge>
          <span>
            <Clock3 aria-hidden="true" />
            Updated {formatComplaintDate(complaint.updatedAt)}
          </span>
        </div>
      </div>

      <Link
        className="hm-complaint-list__detail-link"
        to={`/student/complaints/${complaint.id}`}
        aria-label={`View complaint ${complaint.id}`}
      >
        View details
        <ChevronRight aria-hidden="true" />
      </Link>
    </li>
  );
};
