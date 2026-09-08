import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, test, vi } from "vitest";
import ComplaintDetail from "../../src/pages/ComplaintDetail.jsx";
import AllComplaintsAdmin from "../../src/pages/AllComplaintsAdmin.jsx";
import MyComplaints from "../../src/pages/MyComplaints.jsx";
import RaiseComplaint from "../../src/pages/RaiseComplaint.jsx";
import {
  assignComplaint,
  createComplaint,
  getComplaint,
  getComplaintAssignees,
  getComplaintCategories,
  getManagedComplaints,
  getMyComplaints,
  verifyComplaint,
} from "../../src/complaints/complaintApi.js";
import { expectNoAccessibilityViolations } from "../support/accessibility.js";

const { showToast } = vi.hoisted(() => ({ showToast: vi.fn() }));

vi.mock("../../src/complaints/complaintApi.js", () => ({
  addComplaintAttachment: vi.fn(),
  assignComplaint: vi.fn(),
  createComplaint: vi.fn(),
  getComplaint: vi.fn(),
  getComplaintAttachmentBlob: vi.fn(),
  getComplaintAssignees: vi.fn(),
  getComplaintCategories: vi.fn(),
  getManagedComplaints: vi.fn(),
  getMyComplaints: vi.fn(),
  removeComplaintAttachment: vi.fn(),
  verifyComplaint: vi.fn(),
}));

vi.mock("../../src/feedback/toastContext.js", () => ({
  useToast: () => ({ showToast }),
}));

const complaint = Object.freeze({
  id: 42,
  category: { code: "plumbing", name: "Plumbing" },
  hostel: { code: "H1", name: "North Residence Hall" },
  room: { id: 7, number: "204", label: "A-204" },
  location: "A-204 bathroom",
  description: "The washbasin pipe is leaking onto the bathroom floor.",
  reportedBy: { id: 2, name: "Kavya Nair" },
  priority: "high",
  status: "resolved",
  sla: {
    state: "completed",
    breached: false,
    remainingSeconds: null,
  },
  assignment: {
    id: 8,
    assignee: { id: 9, name: "Ravi Kumar" },
    assignedAt: "2026-09-08T08:05:00.000Z",
  },
  resolutionNote: "Replaced the damaged pipe joint and tested the basin.",
  createdAt: "2026-09-08T08:00:00.000Z",
  updatedAt: "2026-09-08T08:30:00.000Z",
  timeline: [
    {
      id: 1,
      type: "created",
      toStatus: "created",
      actor: { id: 2, name: "Kavya Nair", role: "student" },
      note: null,
      occurredAt: "2026-09-08T08:00:00.000Z",
    },
    {
      id: 2,
      type: "resolved",
      toStatus: "resolved",
      actor: { id: 9, name: "Ravi Kumar", role: "maintenance" },
      note: "Replaced the damaged pipe joint and tested the basin.",
      occurredAt: "2026-09-08T08:30:00.000Z",
    },
  ],
});

const managedComplaint = Object.freeze({
  ...complaint,
  id: 77,
  status: "created",
  assignment: null,
  resolutionNote: null,
  sla: {
    state: "active",
    breached: false,
    remainingSeconds: 3600,
  },
});

describe("student complaint workflow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getComplaintCategories.mockResolvedValue([
      { code: "plumbing", name: "Plumbing" },
    ]);
    getMyComplaints.mockResolvedValue({
      data: [complaint],
      pagination: { page: 1, pageSize: 10, total: 1, totalPages: 1 },
    });
    getComplaint.mockResolvedValue({ complaint, attachments: [] });
    getManagedComplaints.mockResolvedValue({
      data: [managedComplaint],
      pagination: { page: 1, pageSize: 15, total: 1, totalPages: 1 },
    });
    getComplaintAssignees.mockResolvedValue({
      hostel: managedComplaint.hostel,
      data: [
        {
          id: 9,
          name: "Ravi Kumar",
          email: "ravi@example.com",
          activeAssignmentCount: 2,
        },
        {
          id: 12,
          name: "Nisha Das",
          email: "nisha@example.com",
          activeAssignmentCount: 0,
        },
      ],
    });
  });

  test("shows a readable server-backed complaint list", async () => {
    const view = render(
      <MemoryRouter>
        <MyComplaints />
      </MemoryRouter>
    );

    expect(await screen.findByText("Complaint #42")).toBeVisible();
    expect(screen.getByText("A-204")).toBeVisible();
    expect(screen.getByText("SLA completed")).toBeVisible();
    expect(screen.getByRole("link", { name: "View complaint 42" })).toHaveAttribute(
      "href",
      "/student/complaints/42"
    );
    expect(getMyComplaints).toHaveBeenCalledWith({ page: 1, status: "" });
    await expectNoAccessibilityViolations(view.container);
  });

  test("creates a normalized complaint and opens its detail page", async () => {
    const user = userEvent.setup();
    createComplaint.mockResolvedValue({ id: 91 });
    render(
      <MemoryRouter initialEntries={["/student/complaints/raise"]}>
        <Routes>
          <Route path="/student/complaints/raise" element={<RaiseComplaint />} />
          <Route path="/student/complaints/:id" element={<p>Complaint details opened</p>} />
        </Routes>
      </MemoryRouter>
    );

    await screen.findByRole("option", { name: "Plumbing" });
    await user.type(screen.getByLabelText("Room or location"), "A-204 bathroom");
    await user.type(
      screen.getByLabelText("Issue description"),
      "The washbasin pipe has been leaking since this morning."
    );
    await user.click(screen.getByRole("button", { name: "Create complaint" }));

    await screen.findByText("Complaint details opened");
    expect(createComplaint).toHaveBeenCalledWith({
      categoryCode: "plumbing",
      location: "A-204 bathroom",
      description: "The washbasin pipe has been leaking since this morning.",
    });
  });

  test("requires a reason and reopens only the displayed complaint", async () => {
    const user = userEvent.setup();
    verifyComplaint.mockResolvedValue({
      ...complaint,
      status: "in_progress",
      resolutionNote: null,
    });
    render(
      <MemoryRouter initialEntries={["/student/complaints/42"]}>
        <Routes>
          <Route path="/student/complaints/:id" element={<ComplaintDetail />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByRole("heading", { name: "Plumbing" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Reopen" }));
    await user.click(screen.getByRole("button", { name: "Reopen complaint" }));
    expect(screen.getByRole("alert")).toHaveTextContent("at least 10 characters");

    await user.type(
      screen.getByLabelText("Reason for reopening"),
      "The pipe started leaking again."
    );
    await user.click(screen.getByRole("button", { name: "Reopen complaint" }));

    await waitFor(() =>
      expect(verifyComplaint).toHaveBeenCalledWith(42, {
        action: "reopen",
        reason: "The pipe started leaking again.",
      })
    );
    expect(showToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Complaint reopened" })
    );
  });
});

describe("managed complaint workflow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getComplaintCategories.mockResolvedValue([
      { code: "plumbing", name: "Plumbing" },
    ]);
    getManagedComplaints.mockResolvedValue({
      data: [managedComplaint],
      pagination: { page: 1, pageSize: 15, total: 1, totalPages: 1 },
    });
    getComplaint.mockResolvedValue({
      complaint: { ...managedComplaint, timeline: complaint.timeline },
      attachments: [],
    });
    getComplaintAssignees.mockResolvedValue({
      hostel: managedComplaint.hostel,
      data: [
        {
          id: 9,
          name: "Ravi Kumar",
          email: "ravi@example.com",
          activeAssignmentCount: 2,
        },
        {
          id: 12,
          name: "Nisha Das",
          email: "nisha@example.com",
          activeAssignmentCount: 0,
        },
      ],
    });
  });

  test("loads an SLA-first queue and applies server-side filters", async () => {
    const user = userEvent.setup();
    const view = render(
      <MemoryRouter>
        <AllComplaintsAdmin />
      </MemoryRouter>
    );

    expect(await screen.findByRole("heading", { name: "Complaint queue" })).toBeVisible();
    expect(screen.getAllByText("#77 · Plumbing")[0]).toBeVisible();
    expect(getManagedComplaints).toHaveBeenCalledWith({
      page: 1,
      slaState: "open",
      sortBy: "slaDeadline",
      sortOrder: "asc",
    });

    await user.type(screen.getByLabelText("Search"), "washbasin");
    await user.selectOptions(screen.getByLabelText("Priority"), "high");
    await user.click(screen.getByRole("button", { name: "Apply filters" }));

    await waitFor(() =>
      expect(getManagedComplaints).toHaveBeenLastCalledWith({
        page: 1,
        search: "washbasin",
        priority: "high",
        slaState: "open",
        sortBy: "slaDeadline",
        sortOrder: "asc",
      })
    );
    await expectNoAccessibilityViolations(view.container);
  });

  test("opens complaint context and assigns an available technician", async () => {
    const user = userEvent.setup();
    assignComplaint.mockResolvedValue({
      complaint: {
        ...managedComplaint,
        status: "assigned",
        assignment: complaint.assignment,
        timeline: complaint.timeline,
      },
    });
    render(
      <MemoryRouter>
        <AllComplaintsAdmin />
      </MemoryRouter>
    );

    await screen.findByText("1 complaint");
    await user.click(screen.getAllByRole("button", { name: "View complaint 77" })[0]);
    expect(await screen.findByRole("heading", { name: "Complaint #77" })).toBeVisible();
    expect(screen.getByText("A-204 bathroom")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Assign technician" }));
    expect(await screen.findByRole("heading", { name: "Assign complaint" })).toBeVisible();
    expect(getComplaintAssignees).toHaveBeenCalledWith("H1");
    await user.selectOptions(screen.getByLabelText("Maintenance technician"), "9");
    await user.click(screen.getByRole("button", { name: "Assign technician" }));

    await waitFor(() =>
      expect(assignComplaint).toHaveBeenCalledWith(77, { assigneeUserId: 9 })
    );
    expect(showToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Complaint assigned" })
    );
  });

  test("requires an operational reason before reassignment", async () => {
    const user = userEvent.setup();
    const assignedComplaint = {
      ...complaint,
      status: "assigned",
      resolutionNote: null,
      sla: managedComplaint.sla,
    };
    getManagedComplaints.mockResolvedValue({
      data: [assignedComplaint],
      pagination: { page: 1, pageSize: 15, total: 1, totalPages: 1 },
    });
    assignComplaint.mockResolvedValue({ complaint: assignedComplaint });
    render(
      <MemoryRouter>
        <AllComplaintsAdmin />
      </MemoryRouter>
    );

    await screen.findByText("1 complaint");
    await user.click(screen.getAllByRole("button", { name: "Reassign" })[0]);
    expect(await screen.findByRole("heading", { name: "Reassign complaint" })).toBeVisible();
    await user.selectOptions(screen.getByLabelText("Maintenance technician"), "12");
    await user.click(screen.getByRole("button", { name: "Reassign technician" }));
    expect(screen.getByRole("alert")).toHaveTextContent("at least 5 characters");
    expect(assignComplaint).not.toHaveBeenCalled();

    await user.type(
      screen.getByLabelText("Reason for reassignment"),
      "Technician is handling an urgent repair."
    );
    await user.click(screen.getByRole("button", { name: "Reassign technician" }));

    await waitFor(() =>
      expect(assignComplaint).toHaveBeenCalledWith(42, {
        assigneeUserId: 12,
        reason: "Technician is handling an urgent repair.",
      })
    );
  });
});
