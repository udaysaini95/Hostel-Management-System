import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, test, vi } from "vitest";
import ApplyLeave from "../../src/pages/ApplyLeave.jsx";
import MyLeaves from "../../src/pages/MyLeaves.jsx";
import { expectNoAccessibilityViolations } from "../support/accessibility.js";

const apiMocks = vi.hoisted(() => ({
  createLeaveRequest: vi.fn(),
  downloadGatePassPdf: vi.fn(),
  listMyLeaveRequests: vi.fn(),
  loadGatePassImage: vi.fn(),
}));
const { showToast } = vi.hoisted(() => ({ showToast: vi.fn() }));

vi.mock("../../src/leave/leaveApi.js", () => apiMocks);
vi.mock("../../src/feedback/toastContext.js", () => ({
  useToast: () => ({ showToast }),
}));

const approvedLeave = Object.freeze({
  id: 42,
  reason: "Family function in Pune",
  departureAt: "2099-09-10T08:00:00.000Z",
  expectedReturnAt: "2099-09-12T18:00:00.000Z",
  isEmergency: false,
  status: "approved",
  hostel: { id: 1, code: "H1", name: "North Hall" },
  room: { blockCode: "A", roomNumber: "101" },
  pass: {
    id: 9,
    validFrom: "2099-09-10T08:00:00.000Z",
    expiresAt: "2099-09-12T18:00:00.000Z",
    revokedAt: null,
  },
});

const renderWithRouter = (component) =>
  render(<MemoryRouter>{component}</MemoryRouter>);

describe("student leave and gate-pass flow", () => {
  beforeEach(() => {
    Object.values(apiMocks).forEach((mock) => mock.mockReset());
    showToast.mockReset();
    apiMocks.listMyLeaveRequests.mockResolvedValue({
      data: [approvedLeave],
      pagination: { page: 1, pageSize: 10, total: 1, totalPages: 1 },
    });
    apiMocks.loadGatePassImage.mockResolvedValue("blob:private-gate-pass");
    URL.revokeObjectURL = vi.fn();
  });

  test("places the current private pass before leave history", async () => {
    const view = renderWithRouter(<MyLeaves />);

    expect(
      await screen.findByRole("heading", { name: "Approved" })
    ).toBeVisible();
    expect(
      await screen.findByAltText("QR code for the current HostelMate gate pass")
    ).toHaveAttribute("src", "blob:private-gate-pass");
    expect(screen.getAllByText("Family function in Pune")).toHaveLength(2);
    expect(apiMocks.listMyLeaveRequests).toHaveBeenCalledWith({
      page: 1,
      pageSize: 10,
    });
    await expectNoAccessibilityViolations(view.container);
  });

  test("shows a service failure instead of a successful empty state", async () => {
    apiMocks.listMyLeaveRequests.mockRejectedValue({
      response: { data: { message: "Leave service is unavailable." } },
    });
    renderWithRouter(<MyLeaves />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Leave service is unavailable."
    );
    expect(screen.queryByText("No leave requests yet")).not.toBeInTheDocument();
  });

  test("submits exact timestamps and the emergency flag", async () => {
    const user = userEvent.setup();
    apiMocks.createLeaveRequest.mockResolvedValue({ id: 51 });
    renderWithRouter(<ApplyLeave />);

    fireEvent.change(screen.getByLabelText("Departure date and time"), {
      target: { value: "2099-10-10T08:30" },
    });
    fireEvent.change(screen.getByLabelText("Expected return date and time"), {
      target: { value: "2099-10-12T18:00" },
    });
    await user.type(
      screen.getByLabelText("Reason for leave"),
      "Family wedding in another city"
    );
    await user.click(
      screen.getByRole("checkbox", { name: /This is an emergency request/ })
    );
    await user.click(screen.getByRole("button", { name: "Apply for leave" }));

    await waitFor(() => expect(apiMocks.createLeaveRequest).toHaveBeenCalled());
    const payload = apiMocks.createLeaveRequest.mock.calls[0][0];
    expect(payload.reason).toBe("Family wedding in another city");
    expect(payload.isEmergency).toBe(true);
    expect(payload.departureAt).toMatch(/Z$/);
    expect(showToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Leave request submitted" })
    );
  });

  test("keeps invalid date ranges on the client and focuses return time", async () => {
    const user = userEvent.setup();
    renderWithRouter(<ApplyLeave />);

    fireEvent.change(screen.getByLabelText("Departure date and time"), {
      target: { value: "2099-10-12T18:00" },
    });
    fireEvent.change(screen.getByLabelText("Expected return date and time"), {
      target: { value: "2099-10-10T08:30" },
    });
    await user.type(screen.getByLabelText("Reason for leave"), "Going home");
    await user.click(screen.getByRole("button", { name: "Apply for leave" }));

    expect(screen.getByLabelText("Expected return date and time")).toHaveFocus();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Expected return must be after departure."
    );
    expect(apiMocks.createLeaveRequest).not.toHaveBeenCalled();
  });
});
