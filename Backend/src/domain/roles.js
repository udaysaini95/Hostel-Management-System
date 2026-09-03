export const USER_ROLES = Object.freeze({
  STUDENT: "student",
  WARDEN: "warden",
  MAINTENANCE: "maintenance",
  GUARD: "guard",
  ADMIN: "admin",
});

export const STAFF_ROLES = Object.freeze([
  USER_ROLES.WARDEN,
  USER_ROLES.MAINTENANCE,
  USER_ROLES.GUARD,
  USER_ROLES.ADMIN,
]);

export const normalizeEmail = (email) => email.toLowerCase().trim();
