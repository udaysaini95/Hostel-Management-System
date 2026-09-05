export const USER_ROLES = Object.freeze({
  STUDENT: "student",
  WARDEN: "warden",
  MAINTENANCE: "maintenance",
  GUARD: "guard",
  ADMIN: "admin",
});

export const USER_ROLE_VALUES = Object.freeze(Object.values(USER_ROLES));

export const isSupportedRole = (role) => USER_ROLE_VALUES.includes(role);
