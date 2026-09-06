export const AUDIT_CATEGORIES = Object.freeze({
  ACCOUNT: "account",
  STUDENT: "student",
  ROOM: "room",
  COMPLAINT: "complaint",
  LEAVE: "leave",
  GATE: "gate",
  MESS: "mess",
  NOTICE: "notice",
});

export const AUDIT_ACTIONS = Object.freeze({
  STAFF_INVITATION_CREATED: "staff.invitation.created",
  ACCOUNT_STATUS_CHANGED: "account.status.changed",
  STUDENT_APPROVAL_CREATED: "student.approval.created",
  STUDENT_APPROVAL_REVOKED: "student.approval.revoked",
  STUDENT_APPROVAL_REINSTATED: "student.approval.reinstated",
  STUDENT_ACTIVATION_REISSUED: "student.activation.reissued",
  ROOM_ALLOCATION_CREATED: "room.allocation.created",
  ROOM_ALLOCATION_VACATED: "room.allocation.vacated",
});

export const AUDIT_RESOURCE_TYPES = Object.freeze({
  STAFF_INVITATION: "staff_invitation",
  USER_ACCOUNT: "user_account",
  APPROVED_STUDENT: "approved_student",
  ROOM_ALLOCATION: "room_allocation",
});
