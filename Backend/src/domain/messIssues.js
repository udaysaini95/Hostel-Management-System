export const MESS_ISSUE_TYPES = Object.freeze({
  FOOD_QUALITY: "food_quality",
  HYGIENE: "hygiene",
  QUANTITY: "quantity",
  STAFF_BEHAVIOR: "staff_behavior",
  OTHER: "other",
});

export const MESS_ISSUE_STATUSES = Object.freeze({
  REPORTED: "reported",
  IN_PROGRESS: "in_progress",
  RESOLVED: "resolved",
});

const nextStatus = Object.freeze({
  [MESS_ISSUE_STATUSES.REPORTED]: MESS_ISSUE_STATUSES.IN_PROGRESS,
  [MESS_ISSUE_STATUSES.IN_PROGRESS]: MESS_ISSUE_STATUSES.RESOLVED,
});

export const canTransitionMessIssue = (fromStatus, toStatus) =>
  nextStatus[fromStatus] === toStatus;
