import {
  ClipboardList,
  FileCheck2,
  LayoutDashboard,
  QrCode,
  Utensils,
} from "lucide-react";
import { USER_ROLES } from "../auth/roles.js";

const studentNavigation = Object.freeze([
  {
    label: "Overview",
    path: "/student/dashboard",
    icon: LayoutDashboard,
    exact: true,
  },
  {
    label: "Complaints",
    path: "/student/complaints",
    icon: ClipboardList,
  },
  {
    label: "Leave and gate pass",
    path: "/student/leaves",
    icon: FileCheck2,
  },
  { label: "Mess", path: "/student/mess", icon: Utensils, exact: true },
]);

const operationsNavigation = Object.freeze([
  {
    label: "Overview",
    path: "/admin/dashboard",
    icon: LayoutDashboard,
    exact: true,
  },
  {
    label: "Complaints",
    path: "/admin/complaints",
    icon: ClipboardList,
    exact: true,
  },
  {
    label: "Leave requests",
    path: "/admin/leaves",
    icon: FileCheck2,
    exact: true,
  },
  { label: "Mess", path: "/admin/mess", icon: Utensils, exact: true },
]);

const adminNavigation = Object.freeze([
  ...operationsNavigation,
  { label: "Gate terminal", path: "/guard/terminal", icon: QrCode, exact: true },
]);

const roleNavigation = Object.freeze({
  [USER_ROLES.STUDENT]: studentNavigation,
  [USER_ROLES.WARDEN]: operationsNavigation,
  [USER_ROLES.ADMIN]: adminNavigation,
  [USER_ROLES.GUARD]: Object.freeze([
    { label: "Gate terminal", path: "/guard/terminal", icon: QrCode },
  ]),
  [USER_ROLES.MAINTENANCE]: Object.freeze([
    { label: "Mess", path: "/student/mess", icon: Utensils, exact: true },
  ]),
});

export const ROLE_LABELS = Object.freeze({
  [USER_ROLES.STUDENT]: "Student",
  [USER_ROLES.WARDEN]: "Warden",
  [USER_ROLES.MAINTENANCE]: "Maintenance",
  [USER_ROLES.GUARD]: "Gate security",
  [USER_ROLES.ADMIN]: "Administrator",
});

export const getNavigationForRole = (role) => roleNavigation[role] ?? [];

export const isNavigationItemActive = (pathname, item) => {
  if (item.exact) {
    return pathname === item.path;
  }

  return pathname === item.path || pathname.startsWith(`${item.path}/`);
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
  "/admin/dashboard": "Operations overview",
  "/admin/complaints": "Complaint queue",
  "/admin/leaves": "Leave requests",
  "/admin/mess": "Mess management",
  "/guard/terminal": "Gate terminal",
  "/unauthorized": "Access denied",
});

export const getRouteTitle = (pathname) => routeTitles[pathname] ?? "HostelMate";
