export const DASHBOARD_PERIOD_DAYS = 30;

export const DASHBOARD_LINKS = Object.freeze({
  STUDENT_COMPLAINTS: "/student/complaints",
  STUDENT_LEAVES: "/student/leaves",
  STUDENT_MESS: "/student/mess",
  NOTICES: "/notices",
  MANAGED_COMPLAINTS: "/admin/complaints",
  MANAGED_LEAVES: "/admin/leaves",
  MANAGED_MESS: "/admin/mess",
  GATE_TERMINAL: "/guard/terminal",
  MAINTENANCE_WORK: "/maintenance/work-orders",
  RESIDENTS_AND_ROOMS: "/admin/residents",
  STUDENT_ONBOARDING: "/admin/student-approvals",
  AUDIT_LOG: "/admin/audit",
});

export const DASHBOARD_DEFINITIONS = Object.freeze({
  OPEN_COMPLAINTS: "Complaints whose current status is not closed.",
  SLA_BREACHED: "Open complaints whose SLA deadline is earlier than the generated time.",
  STUDENTS_OUTSIDE: "Exited leaves without a subsequent successful return.",
  OVERDUE_RETURNS: "Students outside whose expected return time has passed.",
  MESS_AVERAGE: "Arithmetic mean of valid ratings for menus in the displayed period.",
  ROOM_OCCUPANCY: "Active room allocations divided by configured capacity of active rooms.",
  AUDIT_EXCEPTIONS: "SLA breach and gate override audit events recorded in the previous 24 hours.",
});
