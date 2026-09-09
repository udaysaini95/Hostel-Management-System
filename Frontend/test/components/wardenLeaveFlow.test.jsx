import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, test, vi } from "vitest";
import AdminLeaves from "../../src/pages/AdminLeaves.jsx";
import { expectNoAccessibilityViolations } from "../support/accessibility.js";

const apiMocks = vi.hoisted(() => ({
  decideLeaveRequest: vi.fn(),
  listLeaveReviewQueue: vi.fn(),
}));
const { showToast } = vi.hoisted(() => ({ showToast: vi.fn() }));

vi.mock("../../src/leave/leaveReviewApi.js", () => apiMocks);
vi.mock("../../src/feedback/toastContext.js", () => ({
  useToast: () => ({ showToast }),
}));

const pendingLeave = Object.freeze({
  id: 71,
  reason: "Medical consultation with specialist",
  departureAt: "2099-10-10T08:00:00.000Z",
  expectedReturnAt: "2099-10-10T18:00:00.000Z",
  isEmergency: true,
  status: "pending",
  createdAt: "2099-10-01T07:30:00.000Z",
  student: {
    userId: 22,
    name: "Kavya Nair",
    email: "student.h1@hostelmate.example",
    rollNo: "DEMO-H1-001",
  },
  hostel: { id: 1, code: "H1", name: "North Residence Hall" },
  room: { blockCode: "A", roomNumber: "101", label: "A-101" },
  decision: null,
  reviewWarnings: { hasOverlap: false, activeRequests: [] },
});

const queueResponse = {
  data: [pendingLeave],
  pagination: { page: 1, pageSize: 15, total: 1, totalPages: 1 },
};

const renderPage = () =>
  render(<MemoryRouter><AdminLeaves /></MemoryRouter>);

describe("warden leave review flow", () => {
  beforeEach(() => {
    Object.values(apiMocks).forEach((mock) => mock.mockReset());
    showToast.mockReset();
    apiMocks.listLeaveReviewQueue.mockResolvedValue(queueResponse);
    apiMocks.decideLeaveRequest.mockResolvedValue({
      leaveRequest: { ...pendingLeave, status: "approved" },
    });
  });

  test("loads the pending hostel queue with operational details", async () => {
    const view = renderPage();

    expect(await screen.findAllByText("Kavya Nair")).not.toHaveLength(0);
    expect(screen.getAllByText("A-101")).not.toHaveLength(0);
    expect(screen.getAllByText("Medical consultation with specialist")).not.toHaveLength(0);
    expect(screen.getAllByText("Emergency")).not.toHaveLength(0);
    expect(apiMocks.listLeaveReviewQueue).toHaveBeenCalledWith({
      page: 1,
      pageSize: 15,
      status: "pending",
    });
    await expectNoAccessibilityViolations(view.container);
  });

  test("approval dialog requires and submits an auditable note", async () => {
    const user = userEvent.setup();
    renderPage();
    const table = await screen.findByRole("table", { name: "Student leave requests" });

    await user.click(within(table).getByRole("button", { name: "Approve" }));
    const dialog = screen.getByRole("dialog", { name: "Approve leave request" });
    await user.click(within(dialog).getByRole("button", { name: "Approve and issue pass" }));
    expect(within(dialog).getByLabelText("Decision note")).toHaveFocus();
    expect(within(dialog).getByRole("alert")).toHaveTextContent("at least 5 characters");

    await user.type(within(dialog).getByLabelText("Decision note"), "Student identity and travel details verified");
    await user.click(within(dialog).getByRole("button", { name: "Approve and issue pass" }));

    await waitFor(() => {
      expect(apiMocks.decideLeaveRequest).toHaveBeenCalledWith(71, {
        outcome: "approved",
        note: "Student identity and travel details verified",
      });
    });
    expect(showToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Leave approved" })
    );
  });

  test("shows an overlap conflict and disables approval", async () => {
    apiMocks.listLeaveReviewQueue.mockResolvedValue({
      ...queueResponse,
      data: [{
        ...pendingLeave,
        reviewWarnings: {
          hasOverlap: true,
          activeRequests: [{ id: 70, overlapsSchedule: true }],
        },
      }],
    });
    renderPage();
    const table = await screen.findByRole("table", { name: "Student leave requests" });

    expect(within(table).getByText("Overlapping active leave detected")).toBeVisible();
    expect(within(table).getByRole("button", { name: "Approve" })).toBeDisabled();
    expect(within(table).getByRole("button", { name: "Reject" })).toBeEnabled();
  });

  test("completed requests remain available through status and search filters", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findAllByText("Kavya Nair");

    await user.selectOptions(screen.getByLabelText("Request status"), "all");
    await user.type(screen.getByLabelText("Search requests"), "DEMO-H1-001");
    await user.click(screen.getByRole("button", { name: "Search" }));

    await waitFor(() => {
      expect(apiMocks.listLeaveReviewQueue).toHaveBeenLastCalledWith({
        page: 1,
        pageSize: 15,
        status: "all",
        search: "DEMO-H1-001",
      });
    });
  });
});
