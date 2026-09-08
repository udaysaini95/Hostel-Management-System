import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, test, vi } from "vitest";
import ComplaintDetail from "../../src/pages/ComplaintDetail.jsx";
import AllComplaintsAdmin from "../../src/pages/AllComplaintsAdmin.jsx";
import MaintenanceWorkOrders from "../../src/pages/MaintenanceWorkOrders.jsx";
import MyComplaints from "../../src/pages/MyComplaints.jsx";
import RaiseComplaint from "../../src/pages/RaiseComplaint.jsx";
import {
  assignComplaint,
  createComplaint,
  getComplaint,
  getComplaintAssignees,
  getComplaintCategories,
  getManagedComplaints,
  getMaintenanceWorkQueue,
  getMyComplaints,
  resolveComplaintWork,
  startComplaintWork,
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
  getMaintenanceWorkQueue: vi.fn(),
  getMyComplaints: vi.fn(),
  removeComplaintAttachment: vi.fn(),
  resolveComplaintWork: vi.fn(),
  startComplaintWork: vi.fn(),
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

describe("maintenance work portal", () => {
  const assignedWork = Object.freeze({
    ...complaint,
    status: "assigned",
    resolutionNote: null,
    sla: managedComplaint.sla,
    timeline: complaint.timeline,
  });
  const inProgressWork = Object.freeze({
    ...assignedWork,
    status: "in_progress",
  });

  beforeEach(() => {
    vi.clearAllMocks();
    getMaintenanceWorkQueue.mockResolvedValue({
      data: [assignedWork],
      pagination: { page: 1, pageSize: 12, total: 1, totalPages: 1 },
    });
    getComplaint.mockResolvedValue({ complaint: assignedWork, attachments: [] });
  });

  test("shows only active assigned work by default and separates resolved work", async () => {
    const user = userEvent.setup();
    const view = render(
      <MemoryRouter>
        <MaintenanceWorkOrders />
      </MemoryRouter>
    );

    expect(await screen.findByRole("heading", { name: "Assigned work" })).toBeVisible();
    expect(screen.getByText("Complaint #42")).toBeVisible();
    expect(screen.getByRole("button", { name: "Start work" })).toBeVisible();
    expect(getMaintenanceWorkQueue).toHaveBeenCalledWith({
      page: 1,
      slaState: "open",
      sortBy: "priority",
      sortOrder: "asc",
    });

    getMaintenanceWorkQueue.mockResolvedValueOnce({
      data: [{ ...assignedWork, status: "resolved" }],
      pagination: { page: 1, pageSize: 12, total: 1, totalPages: 1 },
    });
    await user.click(
      screen.getByRole("tab", { name: "Awaiting student confirmation" })
    );
    await waitFor(() =>
      expect(getMaintenanceWorkQueue).toHaveBeenLastCalledWith({
        page: 1,
        status: "resolved",
        slaState: "all",
        sortBy: "updatedAt",
        sortOrder: "desc",
      })
    );
    await expectNoAccessibilityViolations(view.container);
  });

  test("starts only the selected assigned work order after confirmation", async () => {
    const user = userEvent.setup();
    startComplaintWork.mockResolvedValue(inProgressWork);
    render(
      <MemoryRouter>
        <MaintenanceWorkOrders />
      </MemoryRouter>
    );

    await screen.findByText("1 work order");
    await user.click(screen.getByRole("button", { name: "Start work" }));
    const dialog = await screen.findByRole("dialog", {
      name: "Start this work order?",
    });
    await user.click(within(dialog).getByRole("button", { name: "Start work" }));

    await waitFor(() => expect(startComplaintWork).toHaveBeenCalledWith(42));
    expect(screen.getByRole("button", { name: "Resolve" })).toBeVisible();
    expect(showToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Work started" })
    );
  });

  test("validates and submits a resolution note with optional evidence", async () => {
    const user = userEvent.setup();
    const evidence = new File(["image-bytes"], "repair.png", {
      type: "image/png",
    });
    getMaintenanceWorkQueue.mockResolvedValue({
      data: [inProgressWork],
      pagination: { page: 1, pageSize: 12, total: 1, totalPages: 1 },
    });
    resolveComplaintWork.mockResolvedValue({
      complaint: {
        ...inProgressWork,
        status: "resolved",
        resolutionNote: "Replaced the damaged valve and tested the water supply.",
      },
      resolutionEvidence: { id: 15, originalName: "repair.png" },
    });
    render(
      <MemoryRouter>
        <MaintenanceWorkOrders />
      </MemoryRouter>
    );

    await screen.findByText("1 work order");
    await user.click(screen.getByRole("button", { name: "Resolve" }));
    const dialog = await screen.findByRole("dialog", {
      name: "Resolve work order",
    });
    await user.click(
      within(dialog).getByRole("button", { name: "Submit resolution" })
    );
    expect(within(dialog).getByRole("alert")).toHaveTextContent(
      "at least 10 characters"
    );

    await user.type(
      within(dialog).getByLabelText("Resolution note"),
      "Replaced the damaged valve and tested the water supply."
    );
    await user.upload(
      within(dialog).getByLabelText("Resolution evidence"),
      evidence
    );
    expect(within(dialog).getByText("repair.png")).toBeVisible();
    await user.click(
      within(dialog).getByRole("button", { name: "Submit resolution" })
    );

    await waitFor(() =>
      expect(resolveComplaintWork).toHaveBeenCalledWith(42, {
        resolutionNote: "Replaced the damaged valve and tested the water supply.",
        file: evidence,
      })
    );
    expect(showToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Resolution submitted" })
    );
  });
});
