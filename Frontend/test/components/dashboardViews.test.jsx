import { createElement } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, test, vi } from "vitest";
import AdminDashboard from "../../src/pages/AdminDashboard.jsx";
import GuardDashboard from "../../src/pages/GuardDashboard.jsx";
import MaintenanceDashboard from "../../src/pages/MaintenanceDashboard.jsx";
import StudentDashboard from "../../src/pages/StudentDashboard.jsx";
import { expectNoAccessibilityViolations } from "../support/accessibility.js";

const dashboardApi = vi.hoisted(() => ({ getDashboardSummary: vi.fn() }));
const auth = vi.hoisted(() => ({ user: { id: 7, role: "student", name: "Aarav" } }));

vi.mock("../../src/dashboard/dashboardApi.js", () => dashboardApi);
vi.mock("../../src/auth/authContext.js", () => ({ useAuth: () => auth }));

const metric = (value, definition, href) => ({ value, definition, href });
const operations = {
  pendingLeaveRequests: metric(3, "Requests awaiting a decision.", "/admin/leaves"),
  openComplaints: metric(8, "Complaints not closed.", "/admin/complaints"),
  slaBreachedComplaints: metric(2, "Open complaints past deadline.", "/admin/complaints"),
  studentsOutside: metric(4, "Students currently outside.", "/guard/terminal"),
  overdueReturns: metric(1, "Outside students past return.", "/guard/terminal"),
  messAverageRating: metric(4.2, "Average rating over 30 days.", "/admin/mess"),
};

const renderDashboard = (Page) => render(
  <MemoryRouter>
    {createElement(Page)}
  </MemoryRouter>
);

describe("role dashboards", () => {
  beforeEach(() => {
    dashboardApi.getDashboardSummary.mockReset();
    auth.user = { id: 7, role: "student", name: "Aarav" };
  });

  test("student overview uses persisted metrics, menu data, and record links", async () => {
    dashboardApi.getDashboardSummary.mockResolvedValue({
      role: "student",
      generatedAt: "2026-09-10T12:00:00.000Z",
      data: {
        activeComplaints: metric(2, "Complaints not closed.", "/student/complaints"),
        unreadNotices: metric(1, "Unread active notices.", "/notices"),
        latestLeave: {
          value: null,
          definition: "Latest submitted leave.",
          href: "/student/leaves",
        },
        todayMenu: {
          value: {
            items: [
              { mealType: "breakfast", name: "Poha", position: 1 },
              { mealType: "lunch", name: "Dal and rice", position: 1 },
            ],
          },
          definition: "Current menu.",
          href: "/student/mess",
        },
      },
    });

    const view = renderDashboard(StudentDashboard);

    expect(await screen.findByText("Active complaints")).toBeVisible();
    expect(screen.getByText("Poha")).toBeVisible();
    const recordLinks = screen.getAllByRole("link", { name: /View records/ });
    expect(recordLinks.some((link) => link.getAttribute("href") === "/student/complaints")).toBe(true);
    expect(screen.getByRole("link", { name: "Open mess menu" })).toHaveAttribute(
      "href",
      "/student/mess"
    );
    await expectNoAccessibilityViolations(view.container);
  });

  test("a failed dashboard request shows an error instead of zero values", async () => {
    dashboardApi.getDashboardSummary.mockRejectedValueOnce({
      response: { data: { message: "Metrics service is unavailable." } },
    });
    dashboardApi.getDashboardSummary.mockResolvedValueOnce({
      role: "warden",
      generatedAt: "2026-09-10T12:00:00.000Z",
      data: operations,
    });
    auth.user = { id: 2, role: "warden", name: "Mira" };
    renderDashboard(AdminDashboard);

    expect(await screen.findByRole("alert")).toHaveTextContent("Metrics service is unavailable.");
    expect(screen.queryByText("Pending leave requests")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Pending leave requests")).toBeVisible();
    expect(dashboardApi.getDashboardSummary).toHaveBeenCalledTimes(2);
  });

  test("missing individual metrics are marked unavailable without hiding valid metrics", async () => {
    dashboardApi.getDashboardSummary.mockResolvedValue({
      role: "warden",
      generatedAt: "2026-09-10T12:00:00.000Z",
      data: { ...operations, overdueReturns: undefined },
    });
    auth.user = { id: 2, role: "warden", name: "Mira" };
    renderDashboard(AdminDashboard);

    expect(await screen.findByText("Open complaints")).toBeVisible();
    expect(screen.getByText("Unavailable")).toBeVisible();
    expect(screen.queryByText(/^0$/)).not.toBeInTheDocument();
  });

  test("administrator receives capacity metrics that wardens do not see", async () => {
    dashboardApi.getDashboardSummary.mockResolvedValue({
      role: "admin",
      generatedAt: "2026-09-10T12:00:00.000Z",
      data: {
        operations,
        administration: {
          totalUsers: metric(80, "All accounts.", "/admin/student-approvals"),
          activeUsers: metric(75, "Active accounts.", "/admin/student-approvals"),
          activeRooms: metric(24, "Active rooms.", "/admin/residents"),
          roomOccupancy: metric(62.5, "Allocated beds over capacity.", "/admin/residents"),
          auditExceptions: metric(1, "Recorded exceptions.", "/admin/audit"),
        },
      },
    });
    auth.user = { id: 1, role: "admin", name: "Mira" };
    renderDashboard(AdminDashboard);

    expect(await screen.findByText("Capacity and account health")).toBeVisible();
    expect(screen.getByText("62.5%")).toBeVisible();
    expect(screen.getByText("Audit exceptions in the last 24 hours")).toBeVisible();
  });

  test("maintenance overview shows only assignment details returned for the staff member", async () => {
    dashboardApi.getDashboardSummary.mockResolvedValue({
      role: "maintenance",
      data: {
        assignedWork: metric(1, "Active assigned work.", "/maintenance/work-orders"),
        slaBreachedWork: metric(1, "Assigned work past deadline.", "/maintenance/work-orders"),
        highPriorityWork: metric(1, "High priority work.", "/maintenance/work-orders"),
        workItems: [{
          id: 41,
          category: "Plumbing",
          priority: "high",
          status: "assigned",
          slaDeadline: "2026-09-10T10:00:00.000Z",
          slaBreached: true,
          href: "/maintenance/work-orders",
        }],
      },
    });
    auth.user = { id: 3, role: "maintenance", name: "Dev" };
    renderDashboard(MaintenanceDashboard);

    expect(await screen.findByText("Complaint #41 · Plumbing")).toBeVisible();
    expect(screen.getByText("SLA breached", { selector: "span" })).toBeVisible();
    expect(screen.queryByText(/room|student email/i)).not.toBeInTheDocument();
  });

  test("guard overview links recent movements back to the terminal", async () => {
    dashboardApi.getDashboardSummary.mockResolvedValue({
      role: "guard",
      data: {
        studentsOutside: metric(1, "Outside students.", "/guard/terminal"),
        overdueReturns: metric(0, "Overdue returns.", "/guard/terminal"),
        recentMovements: [{
          id: 9,
          movement: "exit",
          occurredAt: "2026-09-10T11:30:00.000Z",
          student: { name: "Aarav Singh", rollNo: "H1-014" },
          hostelCode: "H1",
          href: "/guard/terminal",
        }],
      },
    });
    auth.user = { id: 4, role: "guard", name: "Ravi" };
    renderDashboard(GuardDashboard);

    expect(await screen.findByText("Aarav Singh")).toBeVisible();
    expect(screen.getByRole("link", { name: /Aarav Singh/ })).toHaveAttribute(
      "href",
      "/guard/terminal"
    );
  });
});
