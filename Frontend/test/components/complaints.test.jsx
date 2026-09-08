import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, test, vi } from "vitest";
import ComplaintDetail from "../../src/pages/ComplaintDetail.jsx";
import MyComplaints from "../../src/pages/MyComplaints.jsx";
import RaiseComplaint from "../../src/pages/RaiseComplaint.jsx";
import {
  createComplaint,
  getComplaint,
  getComplaintCategories,
  getMyComplaints,
  verifyComplaint,
} from "../../src/complaints/complaintApi.js";
import { expectNoAccessibilityViolations } from "../support/accessibility.js";

const { showToast } = vi.hoisted(() => ({ showToast: vi.fn() }));

vi.mock("../../src/complaints/complaintApi.js", () => ({
  addComplaintAttachment: vi.fn(),
  createComplaint: vi.fn(),
  getComplaint: vi.fn(),
  getComplaintAttachmentBlob: vi.fn(),
  getComplaintCategories: vi.fn(),
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
