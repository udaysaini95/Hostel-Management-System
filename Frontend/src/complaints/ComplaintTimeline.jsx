import { getComplaintStatusLabel, formatComplaintDate } from "./complaintView.js";

const eventLabels = Object.freeze({
  created: "Complaint created",
  assigned: "Maintenance assigned",
  reassigned: "Maintenance reassigned",
  work_started: "Work started",
  resolved: "Marked resolved",
  reopened: "Complaint reopened",
  closed: "Complaint closed",
});

export const ComplaintTimeline = ({ events = [] }) => {
  const newestFirst = [...events].reverse();

  return (
    <ol className="hm-complaint-timeline">
      {newestFirst.map((event) => (
        <li key={event.id} className="hm-complaint-timeline__event">
          <span className="hm-complaint-timeline__marker" aria-hidden="true" />
          <div>
            <div className="hm-complaint-timeline__heading">
              <h3>{eventLabels[event.type] ?? getComplaintStatusLabel(event.toStatus)}</h3>
              <time dateTime={event.occurredAt}>
                {formatComplaintDate(event.occurredAt)}
              </time>
            </div>
            <p className="hm-complaint-timeline__actor">
              {event.actor.name} · {event.actor.role}
            </p>
            {event.note && <p className="hm-complaint-timeline__note">{event.note}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
};
