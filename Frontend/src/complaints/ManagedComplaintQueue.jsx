import { ChevronRight, MapPin, UserRound } from "lucide-react";
import {
  Badge,
  Button,
  StatusBadge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "../components/ui/index.js";
import {
  formatComplaintDate,
  getComplaintPriorityLabel,
  getComplaintPriorityTone,
  getComplaintStatusLabel,
  getSlaPresentation,
} from "./complaintView.js";

const canAssignComplaint = (complaint) =>
  ["created", "assigned", "in_progress"].includes(complaint.status);

const ComplaintBadges = ({ complaint }) => {
  const sla = getSlaPresentation(complaint.sla);

  return (
    <div className="hm-managed-complaints__badges">
      <Badge tone={getComplaintPriorityTone(complaint.priority)}>
        {getComplaintPriorityLabel(complaint.priority)}
      </Badge>
      <Badge tone={sla.tone}>{sla.label}</Badge>
    </div>
  );
};

const RowActions = ({ complaint, onAssign, onOpen }) => (
  <div className="hm-managed-complaints__actions">
    {canAssignComplaint(complaint) && (
      <Button onClick={() => onAssign(complaint)}>
        {complaint.assignment ? "Reassign" : "Assign"}
      </Button>
    )}
    <Button
      variant="quiet"
      aria-label={`View complaint ${complaint.id}`}
      onClick={() => onOpen(complaint.id)}
    >
      View <ChevronRight aria-hidden="true" />
    </Button>
  </div>
);

export const ManagedComplaintQueue = ({ complaints, onAssign, onOpen }) => (
  <>
    <div className="hm-managed-complaints__desktop">
      <Table caption="Managed maintenance complaints" hideCaption>
        <TableHead>
          <TableRow>
            <TableHeaderCell>Complaint</TableHeaderCell>
            <TableHeaderCell>Hostel and location</TableHeaderCell>
            <TableHeaderCell>Urgency</TableHeaderCell>
            <TableHeaderCell>Assignment</TableHeaderCell>
            <TableHeaderCell>Updated</TableHeaderCell>
            <TableHeaderCell><span className="hm-visually-hidden">Actions</span></TableHeaderCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {complaints.map((complaint) => (
            <TableRow key={complaint.id}>
              <TableCell>
                <button
                  type="button"
                  className="hm-managed-complaints__title-button"
                  onClick={() => onOpen(complaint.id)}
                >
                  <span>#{complaint.id} · {complaint.category.name}</span>
                  <small>{complaint.reportedBy.name}</small>
                </button>
              </TableCell>
              <TableCell>
                <strong>{complaint.hostel.code}</strong>
                <small>{complaint.room?.label ?? complaint.location}</small>
              </TableCell>
              <TableCell>
                <StatusBadge status={complaint.status}>
                  {getComplaintStatusLabel(complaint.status)}
                </StatusBadge>
                <ComplaintBadges complaint={complaint} />
              </TableCell>
              <TableCell>
                <strong>{complaint.assignment?.assignee.name ?? "Unassigned"}</strong>
              </TableCell>
              <TableCell>{formatComplaintDate(complaint.updatedAt)}</TableCell>
              <TableCell actions>
                <RowActions complaint={complaint} onAssign={onAssign} onOpen={onOpen} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>

    <ul className="hm-managed-complaints__mobile" aria-label="Managed maintenance complaints">
      {complaints.map((complaint) => (
        <li key={complaint.id}>
          <button
            type="button"
            className="hm-managed-complaints__mobile-heading"
            onClick={() => onOpen(complaint.id)}
          >
            <span>Complaint #{complaint.id}</span>
            <strong>{complaint.category.name}</strong>
          </button>
          <div className="hm-managed-complaints__mobile-meta">
            <span><MapPin aria-hidden="true" /> {complaint.hostel.code} · {complaint.room?.label ?? complaint.location}</span>
            <span><UserRound aria-hidden="true" /> {complaint.assignment?.assignee.name ?? "Unassigned"}</span>
          </div>
          <div className="hm-managed-complaints__mobile-status">
            <StatusBadge status={complaint.status}>
              {getComplaintStatusLabel(complaint.status)}
            </StatusBadge>
            <ComplaintBadges complaint={complaint} />
          </div>
          <RowActions complaint={complaint} onAssign={onAssign} onOpen={onOpen} />
        </li>
      ))}
    </ul>
  </>
);
