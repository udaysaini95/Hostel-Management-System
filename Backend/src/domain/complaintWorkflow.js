import { ApiError } from "../utils/apiErrors.js";

export const COMPLAINT_STATUSES = Object.freeze({
  CREATED: "created",
  ASSIGNED: "assigned",
  IN_PROGRESS: "in_progress",
  RESOLVED: "resolved",
  CLOSED: "closed",
});

export const COMPLAINT_PRIORITIES = Object.freeze({
  CRITICAL: "critical",
  HIGH: "high",
  MEDIUM: "medium",
  LOW: "low",
});

export const COMPLAINT_EVENT_TYPES = Object.freeze({
  CREATED: "created",
  ASSIGNED: "assigned",
  REASSIGNED: "reassigned",
  WORK_STARTED: "work_started",
  SLA_BREACHED: "sla_breached",
  RESOLVED: "resolved",
  REOPENED: "reopened",
  CLOSED: "closed",
});

export const COMPLAINT_ATTACHMENT_PURPOSES = Object.freeze({
  SUBMISSION: "submission",
  RESOLUTION: "resolution",
});

export const COMPLAINT_SLA_MINUTES = Object.freeze({
  [COMPLAINT_PRIORITIES.CRITICAL]: 2 * 60,
  [COMPLAINT_PRIORITIES.HIGH]: 12 * 60,
  [COMPLAINT_PRIORITIES.MEDIUM]: 2 * 24 * 60,
  [COMPLAINT_PRIORITIES.LOW]: 7 * 24 * 60,
});

// A resolved complaint can be reopened when the resident is not satisfied.
// Closed is deliberately terminal so that completed records remain stable.
const ALLOWED_TRANSITIONS = Object.freeze({
  [COMPLAINT_STATUSES.CREATED]: Object.freeze([
    COMPLAINT_STATUSES.ASSIGNED,
  ]),
  [COMPLAINT_STATUSES.ASSIGNED]: Object.freeze([
    COMPLAINT_STATUSES.IN_PROGRESS,
  ]),
  [COMPLAINT_STATUSES.IN_PROGRESS]: Object.freeze([
    COMPLAINT_STATUSES.RESOLVED,
  ]),
  [COMPLAINT_STATUSES.RESOLVED]: Object.freeze([
    COMPLAINT_STATUSES.IN_PROGRESS,
    COMPLAINT_STATUSES.CLOSED,
  ]),
  [COMPLAINT_STATUSES.CLOSED]: Object.freeze([]),
});

export const isComplaintStatus = (status) =>
  Object.values(COMPLAINT_STATUSES).includes(status);

export const getAllowedComplaintTransitions = (status) =>
  ALLOWED_TRANSITIONS[status] ?? [];

export const canTransitionComplaint = (fromStatus, toStatus) =>
  getAllowedComplaintTransitions(fromStatus).includes(toStatus);

export const assertComplaintTransition = (fromStatus, toStatus) => {
  if (!isComplaintStatus(fromStatus) || !isComplaintStatus(toStatus)) {
    throw new ApiError(
      422,
      "INVALID_COMPLAINT_STATUS",
      "The complaint status is not supported"
    );
  }

  if (!canTransitionComplaint(fromStatus, toStatus)) {
    throw new ApiError(
      409,
      "INVALID_COMPLAINT_TRANSITION",
      `A complaint cannot move from ${fromStatus} to ${toStatus}`
    );
  }
};

export const getComplaintSlaDeadline = (
  priority,
  startedAt = new Date()
) => {
  const slaMinutes = COMPLAINT_SLA_MINUTES[priority];
  const startTime = startedAt instanceof Date ? startedAt : new Date(startedAt);

  if (!slaMinutes) {
    throw new ApiError(
      422,
      "INVALID_COMPLAINT_PRIORITY",
      "The complaint priority is not supported"
    );
  }

  if (Number.isNaN(startTime.getTime())) {
    throw new ApiError(
      422,
      "INVALID_COMPLAINT_START_TIME",
      "The complaint start time is invalid"
    );
  }

  return new Date(startTime.getTime() + slaMinutes * 60 * 1000);
};

export const DEFAULT_COMPLAINT_CATEGORIES = Object.freeze([
  Object.freeze({
    code: "electrical",
    name: "Electrical",
    priority: COMPLAINT_PRIORITIES.HIGH,
    slaMinutes: COMPLAINT_SLA_MINUTES[COMPLAINT_PRIORITIES.HIGH],
  }),
  Object.freeze({
    code: "plumbing",
    name: "Plumbing",
    priority: COMPLAINT_PRIORITIES.HIGH,
    slaMinutes: COMPLAINT_SLA_MINUTES[COMPLAINT_PRIORITIES.HIGH],
  }),
  Object.freeze({
    code: "furniture",
    name: "Furniture",
    priority: COMPLAINT_PRIORITIES.MEDIUM,
    slaMinutes: COMPLAINT_SLA_MINUTES[COMPLAINT_PRIORITIES.MEDIUM],
  }),
  Object.freeze({
    code: "internet",
    name: "Wi-Fi / Internet",
    priority: COMPLAINT_PRIORITIES.MEDIUM,
    slaMinutes: COMPLAINT_SLA_MINUTES[COMPLAINT_PRIORITIES.MEDIUM],
  }),
  Object.freeze({
    code: "cleaning",
    name: "Cleaning / Hygiene",
    priority: COMPLAINT_PRIORITIES.MEDIUM,
    slaMinutes: COMPLAINT_SLA_MINUTES[COMPLAINT_PRIORITIES.MEDIUM],
  }),
  Object.freeze({
    code: "other",
    name: "Other",
    priority: COMPLAINT_PRIORITIES.MEDIUM,
    slaMinutes: COMPLAINT_SLA_MINUTES[COMPLAINT_PRIORITIES.MEDIUM],
  }),
]);
