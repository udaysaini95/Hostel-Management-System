import { USER_ROLES, USER_ROLE_VALUES } from "./roles.js";

const roles = (...values) => Object.freeze(values);

export const ROLE_GROUPS = Object.freeze({
  ALL: USER_ROLE_VALUES,
  STUDENT: roles(USER_ROLES.STUDENT),
  ADMIN: roles(USER_ROLES.ADMIN),
  MAINTENANCE: roles(USER_ROLES.MAINTENANCE),
  OPERATIONS: roles(USER_ROLES.ADMIN, USER_ROLES.WARDEN),
  MESS_READER: roles(USER_ROLES.STUDENT, USER_ROLES.MAINTENANCE),
  GATE_ACTIVITY: roles(
    USER_ROLES.ADMIN,
    USER_ROLES.WARDEN,
    USER_ROLES.GUARD
  ),
});

export const ROUTE_ACCESS = Object.freeze({
  "/student/dashboard": ROLE_GROUPS.STUDENT,
  "/student/complaints": ROLE_GROUPS.STUDENT,
  "/student/complaints/raise": ROLE_GROUPS.STUDENT,
  "/student/leaves": ROLE_GROUPS.STUDENT,
  "/student/leaves/apply": ROLE_GROUPS.STUDENT,
  "/student/mess": ROLE_GROUPS.MESS_READER,
  "/student/profile": ROLE_GROUPS.STUDENT,
  "/maintenance/work-orders": ROLE_GROUPS.MAINTENANCE,
  "/admin/dashboard": ROLE_GROUPS.OPERATIONS,
  "/admin/residents": ROLE_GROUPS.OPERATIONS,
  "/admin/student-approvals": ROLE_GROUPS.ADMIN,
  "/admin/complaints": ROLE_GROUPS.OPERATIONS,
  "/admin/leaves": ROLE_GROUPS.OPERATIONS,
  "/admin/mess": ROLE_GROUPS.OPERATIONS,
  "/guard/terminal": ROLE_GROUPS.GATE_ACTIVITY,
  "/notices": ROLE_GROUPS.ALL,
  "/unauthorized": ROLE_GROUPS.ALL,
});

export const canRoleAccessPath = (role, pathname) =>
  ROUTE_ACCESS[pathname]?.includes(role) ?? false;
