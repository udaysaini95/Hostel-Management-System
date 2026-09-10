import {
  ClipboardList,
  FileCheck2,
  LayoutDashboard,
  Megaphone,
  QrCode,
  UserCheck,
  UserRound,
  UsersRound,
  Utensils,
  Wrench,
} from "lucide-react";
import { USER_ROLES } from "../auth/roles.js";

const item = (label, path, icon, exact = true) =>
  Object.freeze({ label, path, icon, exact });

const overview = {
  student: item("Overview", "/student/dashboard", LayoutDashboard),
  operations: item("Overview", "/admin/dashboard", LayoutDashboard),
  guard: item("Overview", "/guard/dashboard", LayoutDashboard),
  maintenance: item("Overview", "/maintenance/dashboard", LayoutDashboard),
};

const notices = item("Notices", "/notices", Megaphone);
const studentMess = item("Mess", "/student/mess", Utensils);

const operations = {
  onboarding: item(
    "Student onboarding",
    "/admin/student-approvals",
    UserCheck
  ),
  residents: item("Residents and rooms", "/admin/residents", UsersRound),
  complaints: item("Complaints", "/admin/complaints", ClipboardList),
  leaves: item("Leave requests", "/admin/leaves", FileCheck2),
  mess: item("Mess", "/admin/mess", Utensils),
  gateActivity: item("Gate activity", "/guard/terminal", QrCode),
  gateTerminal: item("Gate terminal", "/guard/terminal", QrCode),
};

const group = (label, items) => Object.freeze({
  label,
  items: Object.freeze(items),
});

const roleNavigationGroups = Object.freeze({
  [USER_ROLES.STUDENT]: Object.freeze([
    group("Workspace", [overview.student]),
    group("My hostel", [
      item("Complaints", "/student/complaints", ClipboardList, false),
      item("Leave and gate pass", "/student/leaves", FileCheck2, false),
      studentMess,
    ]),
    group("Updates", [notices]),
    group("Account", [item("Profile", "/student/profile", UserRound)]),
  ]),
  [USER_ROLES.WARDEN]: Object.freeze([
    group("Workspace", [overview.operations]),
    group("Resident management", [operations.residents]),
    group("Hostel operations", [
      operations.complaints,
      operations.leaves,
      operations.mess,
    ]),
    group("Communication", [notices]),
    group("Security", [operations.gateActivity]),
  ]),
  [USER_ROLES.ADMIN]: Object.freeze([
    group("Workspace", [overview.operations]),
    group("Resident management", [
      operations.onboarding,
      operations.residents,
    ]),
    group("Hostel operations", [
      operations.complaints,
      operations.leaves,
      operations.mess,
    ]),
    group("Communication", [notices]),
    group("Security", [operations.gateTerminal]),
  ]),
  [USER_ROLES.GUARD]: Object.freeze([
    group("Workspace", [overview.guard]),
    group("Security", [operations.gateTerminal]),
    group("Communication", [notices]),
  ]),
  [USER_ROLES.MAINTENANCE]: Object.freeze([
    group("Workspace", [overview.maintenance]),
    group("Maintenance", [
      item("Work orders", "/maintenance/work-orders", Wrench),
    ]),
    group("Hostel services", [studentMess]),
    group("Communication", [notices]),
  ]),
});

export const ROLE_LABELS = Object.freeze({
  [USER_ROLES.STUDENT]: "Student",
  [USER_ROLES.WARDEN]: "Warden",
  [USER_ROLES.MAINTENANCE]: "Maintenance",
  [USER_ROLES.GUARD]: "Gate security",
  [USER_ROLES.ADMIN]: "Administrator",
});

export const getNavigationGroupsForRole = (role) =>
  roleNavigationGroups[role] ?? [];

export const getNavigationForRole = (role) =>
  getNavigationGroupsForRole(role).flatMap((navigationGroup) =>
    navigationGroup.items
  );

export const isNavigationItemActive = (pathname, navigationItem) => {
  if (navigationItem.exact) {
    return pathname === navigationItem.path;
  }

  return (
    pathname === navigationItem.path ||
    pathname.startsWith(`${navigationItem.path}/`)
  );
};

export const getRoleHome = (role) => {
  const firstItem = getNavigationForRole(role)[0];

  return firstItem?.path ?? "/";
};

const routeTitles = Object.freeze({
  "/student/dashboard": "Overview",
  "/student/complaints": "Complaints",
  "/student/complaints/raise": "Raise complaint",
  "/student/leaves": "Leave and gate pass",
  "/student/leaves/apply": "Apply for leave",
  "/student/mess": "Mess",
  "/student/profile": "My profile",
  "/maintenance/work-orders": "Assigned work",
  "/maintenance/dashboard": "Overview",
  "/admin/dashboard": "Operations overview",
  "/admin/residents": "Residents and rooms",
  "/admin/student-approvals": "Student onboarding",
  "/admin/complaints": "Complaint queue",
  "/admin/leaves": "Leave requests",
  "/admin/mess": "Mess management",
  "/guard/terminal": "Gate terminal",
  "/guard/dashboard": "Overview",
  "/notices": "Notices",
  "/unauthorized": "Access denied",
});

export const getRouteTitle = (pathname) => {
  if (/^\/student\/complaints\/\d+$/.test(pathname)) {
    return "Complaint details";
  }

  return routeTitles[pathname] ?? "HostelMate";
};
