export const APPROVAL_STATUSES = Object.freeze({
  APPROVED: "approved",
  ACTIVATION_PENDING: "activation_pending",
  ACTIVATION_EXPIRED: "activation_expired",
  ACTIVATED: "activated",
  REVOKED: "revoked",
});

export const APPROVAL_ACTIONS = Object.freeze({
  SEND_ACTIVATION: "send_activation",
  RESEND_ACTIVATION: "resend_activation",
  REVOKE: "revoke",
  REINSTATE: "reinstate",
});

export const APPROVAL_STATUS_OPTIONS = Object.freeze([
  { value: "", label: "All statuses" },
  { value: APPROVAL_STATUSES.APPROVED, label: "Approved" },
  {
    value: APPROVAL_STATUSES.ACTIVATION_PENDING,
    label: "Activation sent",
  },
  { value: APPROVAL_STATUSES.ACTIVATION_EXPIRED, label: "Expired" },
  { value: APPROVAL_STATUSES.ACTIVATED, label: "Activated" },
  { value: APPROVAL_STATUSES.REVOKED, label: "Revoked" },
]);

const statusLabels = Object.freeze(
  Object.fromEntries(
    APPROVAL_STATUS_OPTIONS.filter((option) => option.value).map((option) => [
      option.value,
      option.label,
    ])
  )
);

const statusTones = Object.freeze({
  [APPROVAL_STATUSES.APPROVED]: "success",
  [APPROVAL_STATUSES.ACTIVATION_PENDING]: "warning",
  [APPROVAL_STATUSES.ACTIVATION_EXPIRED]: "neutral",
  [APPROVAL_STATUSES.ACTIVATED]: "success",
  [APPROVAL_STATUSES.REVOKED]: "danger",
});

const actionsByStatus = Object.freeze({
  [APPROVAL_STATUSES.APPROVED]: Object.freeze([
    APPROVAL_ACTIONS.SEND_ACTIVATION,
    APPROVAL_ACTIONS.REVOKE,
  ]),
  [APPROVAL_STATUSES.ACTIVATION_PENDING]: Object.freeze([
    APPROVAL_ACTIONS.RESEND_ACTIVATION,
    APPROVAL_ACTIONS.REVOKE,
  ]),
  [APPROVAL_STATUSES.ACTIVATION_EXPIRED]: Object.freeze([
    APPROVAL_ACTIONS.RESEND_ACTIVATION,
    APPROVAL_ACTIONS.REVOKE,
  ]),
  [APPROVAL_STATUSES.ACTIVATED]: Object.freeze([]),
  [APPROVAL_STATUSES.REVOKED]: Object.freeze([
    APPROVAL_ACTIONS.REINSTATE,
  ]),
});

export const getApprovalStatusLabel = (status) =>
  statusLabels[status] ?? "Unknown";

export const getApprovalStatusTone = (status) =>
  statusTones[status] ?? "neutral";

export const getApprovalActions = (status) => actionsByStatus[status] ?? [];

export const formatApprovalDate = (value) => {
  if (!value) {
    return "—";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Unavailable";
  }

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};
