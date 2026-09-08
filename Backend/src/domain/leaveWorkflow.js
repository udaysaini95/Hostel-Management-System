import { ApiError } from "../utils/apiErrors.js";

export const LEAVE_STATUSES = Object.freeze({
  PENDING: "pending",
  REJECTED: "rejected",
  APPROVED: "approved",
  EXITED: "exited",
  RETURNED: "returned",
  EXPIRED: "expired",
});

export const LEAVE_DECISION_OUTCOMES = Object.freeze({
  APPROVED: "approved",
  REJECTED: "rejected",
});

export const LEAVE_EVENT_TYPES = Object.freeze({
  SUBMITTED: "submitted",
  APPROVED: "approved",
  REJECTED: "rejected",
  PASS_ISSUED: "pass_issued",
  EXITED: "exited",
  RETURNED: "returned",
  EXPIRED: "expired",
  OVERRIDE: "override",
});

export const GATE_MOVEMENTS = Object.freeze({
  EXIT: "exit",
  RETURN: "return",
});

export const GATE_VERIFICATION_METHODS = Object.freeze({
  QR: "qr",
  MANUAL: "manual",
  OVERRIDE: "override",
});

const allowedTransitions = Object.freeze({
  [LEAVE_STATUSES.PENDING]: Object.freeze([
    LEAVE_STATUSES.APPROVED,
    LEAVE_STATUSES.REJECTED,
  ]),
  [LEAVE_STATUSES.APPROVED]: Object.freeze([
    LEAVE_STATUSES.EXITED,
    LEAVE_STATUSES.EXPIRED,
  ]),
  [LEAVE_STATUSES.EXITED]: Object.freeze([LEAVE_STATUSES.RETURNED]),
  [LEAVE_STATUSES.REJECTED]: Object.freeze([]),
  [LEAVE_STATUSES.RETURNED]: Object.freeze([]),
  [LEAVE_STATUSES.EXPIRED]: Object.freeze([]),
});

export const getAllowedLeaveTransitions = (status) =>
  allowedTransitions[status] ?? [];

export const canTransitionLeave = (fromStatus, toStatus) =>
  getAllowedLeaveTransitions(fromStatus).includes(toStatus);

export const assertLeaveTransition = (fromStatus, toStatus) => {
  if (!Object.values(LEAVE_STATUSES).includes(fromStatus)) {
    throw new ApiError(
      422,
      "INVALID_LEAVE_STATUS",
      "The current leave status is not supported"
    );
  }

  if (!Object.values(LEAVE_STATUSES).includes(toStatus)) {
    throw new ApiError(
      422,
      "INVALID_LEAVE_STATUS",
      "The requested leave status is not supported"
    );
  }

  if (!canTransitionLeave(fromStatus, toStatus)) {
    throw new ApiError(
      409,
      "INVALID_LEAVE_TRANSITION",
      `A leave request cannot move from ${fromStatus} to ${toStatus}`
    );
  }
};

export const isLeaveOverdue = (leave, now = new Date()) => {
  const currentTime = now instanceof Date ? now : new Date(now);
  const expectedReturn = new Date(leave?.expectedReturnAt);

  if (
    Number.isNaN(currentTime.getTime()) ||
    Number.isNaN(expectedReturn.getTime())
  ) {
    return false;
  }

  return (
    leave?.status === LEAVE_STATUSES.EXITED &&
    expectedReturn.getTime() < currentTime.getTime()
  );
};
