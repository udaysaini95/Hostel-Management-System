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
});

export const AUDIT_RESOURCE_TYPES = Object.freeze({
  STAFF_INVITATION: "staff_invitation",
  USER_ACCOUNT: "user_account",
  APPROVED_STUDENT: "approved_student",
});
