export const NOTIFICATION_EVENT_TYPES = Object.freeze({
  COMPLAINT_REPORTED: "complaint_reported",
  COMPLAINT_ASSIGNED: "complaint_assigned",
  COMPLAINT_RESOLVED: "complaint_resolved",
  LEAVE_SUBMITTED: "leave_submitted",
  LEAVE_DECIDED: "leave_decided",
  GATE_MOVEMENT: "gate_movement",
  IMPORTANT_NOTICE: "important_notice",
});

export const NOTIFICATION_DESTINATIONS = Object.freeze({
  MANAGED_COMPLAINTS: "managed_complaints",
  MAINTENANCE_WORK: "maintenance_work",
  STUDENT_COMPLAINT: "student_complaint",
  MANAGED_LEAVES: "managed_leaves",
  STUDENT_LEAVES: "student_leaves",
  NOTICE_CENTER: "notice_center",
});

export const NOTIFICATION_READ_STATES = Object.freeze({
  ALL: "all",
  READ: "read",
  UNREAD: "unread",
});

export const buildNotificationLink = (destination, resourceId) => {
  if (destination === NOTIFICATION_DESTINATIONS.MANAGED_COMPLAINTS) {
    return "/admin/complaints";
  }
  if (destination === NOTIFICATION_DESTINATIONS.MAINTENANCE_WORK) {
    return "/maintenance/work-orders";
  }
  if (destination === NOTIFICATION_DESTINATIONS.STUDENT_COMPLAINT) {
    return `/student/complaints/${resourceId}`;
  }
  if (destination === NOTIFICATION_DESTINATIONS.MANAGED_LEAVES) {
    return "/admin/leaves";
  }
  if (destination === NOTIFICATION_DESTINATIONS.STUDENT_LEAVES) {
    return "/student/leaves";
  }
  if (destination === NOTIFICATION_DESTINATIONS.NOTICE_CENTER) {
    return "/notices";
  }
  throw new Error(`Unknown notification destination: ${destination}`);
};
