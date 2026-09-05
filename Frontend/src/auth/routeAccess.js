import { USER_ROLES, USER_ROLE_VALUES } from "./roles.js";

const roles = (...values) => Object.freeze(values);

export const ROLE_GROUPS = Object.freeze({
  ALL: USER_ROLE_VALUES,
  STUDENT: roles(USER_ROLES.STUDENT),
  ADMIN: roles(USER_ROLES.ADMIN),
  OPERATIONS: roles(USER_ROLES.ADMIN, USER_ROLES.WARDEN),
  MESS_READER: roles(USER_ROLES.STUDENT, USER_ROLES.MAINTENANCE),
  GATE_TERMINAL: roles(USER_ROLES.ADMIN, USER_ROLES.GUARD),
});

export const ROUTE_ACCESS = Object.freeze({
  "/student/dashboard": ROLE_GROUPS.STUDENT,
  "/student/complaints": ROLE_GROUPS.STUDENT,
  "/student/complaints/raise": ROLE_GROUPS.STUDENT,
  "/student/leaves": ROLE_GROUPS.STUDENT,
  "/student/leaves/apply": ROLE_GROUPS.STUDENT,
  "/student/mess": ROLE_GROUPS.MESS_READER,
  "/admin/dashboard": ROLE_GROUPS.OPERATIONS,
  "/admin/student-approvals": ROLE_GROUPS.ADMIN,
  "/admin/complaints": ROLE_GROUPS.OPERATIONS,
  "/admin/leaves": ROLE_GROUPS.OPERATIONS,
  "/admin/mess": ROLE_GROUPS.OPERATIONS,
  "/guard/terminal": ROLE_GROUPS.GATE_TERMINAL,
  "/unauthorized": ROLE_GROUPS.ALL,
});

export const canRoleAccessPath = (role, pathname) =>
  ROUTE_ACCESS[pathname]?.includes(role) ?? false;
