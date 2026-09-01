export const ACCOUNT_STATUSES = Object.freeze({
  PENDING: "pending",
  ACTIVE: "active",
  SUSPENDED: "suspended",
});

export const canStartSession = (accountStatus) =>
  accountStatus === ACCOUNT_STATUSES.ACTIVE;
