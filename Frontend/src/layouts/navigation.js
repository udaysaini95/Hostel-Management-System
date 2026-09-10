import {
  ClipboardList,
  Wrench,
  FileCheck2,
  LayoutDashboard,
  Megaphone,
  QrCode,
  UserRound,
  UserCheck,
  UsersRound,
  Utensils,
} from "lucide-react";
import { USER_ROLES } from "../auth/roles.js";

const noticesNavigation = Object.freeze({
  label: "Notices",
  path: "/notices",
  icon: Megaphone,
  exact: true,
});

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
  noticesNavigation,
  { label: "Profile", path: "/student/profile", icon: UserRound, exact: true },
]);

const operationsNavigation = Object.freeze([
  {
    label: "Overview",
    path: "/admin/dashboard",
    icon: LayoutDashboard,
    exact: true,
  },
  {
    label: "Residents and rooms",
    path: "/admin/residents",
    icon: UsersRound,
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
  noticesNavigation,
]);

const gateActivityNavigation = Object.freeze({
  label: "Gate activity",
  path: "/guard/terminal",
  icon: QrCode,
  exact: true,
});

const wardenNavigation = Object.freeze([
  ...operationsNavigation,
  gateActivityNavigation,
]);

const adminNavigation = Object.freeze([
  operationsNavigation[0],
  {
    label: "Student onboarding",
    path: "/admin/student-approvals",
    icon: UserCheck,
    exact: true,
  },
  ...operationsNavigation.slice(1),
  { ...gateActivityNavigation, label: "Gate terminal" },
]);

const roleNavigation = Object.freeze({
  [USER_ROLES.STUDENT]: studentNavigation,
  [USER_ROLES.WARDEN]: wardenNavigation,
  [USER_ROLES.ADMIN]: adminNavigation,
  [USER_ROLES.GUARD]: Object.freeze([
    { label: "Overview", path: "/guard/dashboard", icon: LayoutDashboard, exact: true },
    { label: "Gate terminal", path: "/guard/terminal", icon: QrCode },
    noticesNavigation,
  ]),
  [USER_ROLES.MAINTENANCE]: Object.freeze([
    {
      label: "Overview",
      path: "/maintenance/dashboard",
      icon: LayoutDashboard,
      exact: true,
    },
    {
      label: "Work orders",
      path: "/maintenance/work-orders",
      icon: Wrench,
      exact: true,
    },
    { label: "Mess", path: "/student/mess", icon: Utensils, exact: true },
    noticesNavigation,
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
