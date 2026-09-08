const statusLabels = Object.freeze({
  pending: "Pending review",
  approved: "Approved",
  exited: "Currently outside",
  returned: "Returned",
  rejected: "Rejected",
  expired: "Expired",
});

const statusDescriptions = Object.freeze({
  pending: "Waiting for a warden decision.",
  approved: "Your gate pass is ready for verification at the gate.",
  exited: "Your exit was recorded. Present this pass when you return.",
  returned: "Your return was recorded and this leave is complete.",
  rejected: "This request was not approved.",
  expired: "The approved pass was not used before its validity ended.",
});

export const formatLeaveDateTime = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";

  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
};

export const getLeaveDisplayStatus = (leave, now = new Date()) => {
  if (
    leave?.status === "approved" &&
    leave.pass?.expiresAt &&
    new Date(leave.pass.expiresAt).getTime() <= now.getTime()
  ) {
    return "expired";
  }
  return leave?.status || "pending";
};

export const getLeaveStatusLabel = (status) =>
  statusLabels[status] ?? "Unknown status";

export const getLeaveStatusDescription = (status) =>
  statusDescriptions[status] ?? "The current leave state is unavailable.";

export const findCurrentGatePass = (leaves, now = new Date()) =>
  leaves.find((leave) => {
    const status = getLeaveDisplayStatus(leave, now);
    return (
      leave.pass &&
      !leave.pass.revokedAt &&
      (status === "approved" || status === "exited")
    );
  }) ?? null;

export const validateLeaveForm = (form, now = new Date()) => {
  const errors = {};
  const departureAt = new Date(form.departureAt);
  const expectedReturnAt = new Date(form.expectedReturnAt);

  if (form.reason.trim().length < 5) {
    errors.reason = "Enter at least 5 characters explaining the leave.";
  }
  if (!form.departureAt || Number.isNaN(departureAt.getTime())) {
    errors.departureAt = "Choose a valid departure date and time.";
  } else if (departureAt <= now) {
    errors.departureAt = "Departure must be in the future.";
  }
  if (!form.expectedReturnAt || Number.isNaN(expectedReturnAt.getTime())) {
    errors.expectedReturnAt = "Choose a valid expected return date and time.";
  } else if (!errors.departureAt && expectedReturnAt <= departureAt) {
    errors.expectedReturnAt = "Expected return must be after departure.";
  }

  return errors;
};

export const toLeaveRequestPayload = (form) => ({
  reason: form.reason.trim(),
  departureAt: new Date(form.departureAt).toISOString(),
  expectedReturnAt: new Date(form.expectedReturnAt).toISOString(),
  isEmergency: Boolean(form.isEmergency),
});

export const getLeaveFieldErrors = (error) => {
  const serverErrors = error?.response?.data?.fieldErrors ?? {};
  return {
    reason: serverErrors["body.reason"],
    departureAt: serverErrors["body.departureAt"],
    expectedReturnAt: serverErrors["body.expectedReturnAt"],
    isEmergency: serverErrors["body.isEmergency"],
  };
};
