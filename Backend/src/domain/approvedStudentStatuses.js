export const APPROVED_STUDENT_STATUSES = Object.freeze({
  APPROVED: "approved",
  ACTIVATION_PENDING: "activation_pending",
  ACTIVATION_EXPIRED: "activation_expired",
  ACTIVATED: "activated",
  REVOKED: "revoked",
});

const knownStatuses = new Set(Object.values(APPROVED_STUDENT_STATUSES));

export const isApprovedStudentStatus = (status) => knownStatuses.has(status);
