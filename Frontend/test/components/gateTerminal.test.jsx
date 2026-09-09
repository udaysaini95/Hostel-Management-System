import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, test, vi } from "vitest";
import GuardTerminal from "../../src/pages/GuardTerminal.jsx";
import { expectNoAccessibilityViolations } from "../support/accessibility.js";

const apiMocks = vi.hoisted(() => ({
  listGateMovements: vi.fn(),
  listOutsideRoster: vi.fn(),
  recordGateMovement: vi.fn(),
  verifyGatePass: vi.fn(),
}));
const authState = vi.hoisted(() => ({ role: "guard" }));
const { showToast } = vi.hoisted(() => ({ showToast: vi.fn() }));

vi.mock("../../src/gate/gateApi.js", () => apiMocks);
vi.mock("../../src/auth/authContext.js", () => ({
  useAuth: () => ({ user: { id: 4, role: authState.role } }),
}));
vi.mock("../../src/feedback/toastContext.js", () => ({
  useToast: () => ({ showToast }),
}));
vi.mock("../../src/gate/GateScanner.jsx", () => ({
  GateScanner: ({ onScan, onClose }) => (
    <div>
      <button onClick={() => onScan(`hostelmate://gate-pass/${"A".repeat(43)}`)}>
        Complete test scan
      </button>
      <button onClick={onClose}>Close test scanner</button>
    </div>
  ),
}));

const pagination = { page: 1, pageSize: 10, total: 1, totalPages: 1 };
const outsideRecord = Object.freeze({
  leaveRequestId: 12,
  reason: "Home visit",
  departedAt: "2099-11-10T08:30:00.000Z",
  expectedReturnAt: "2099-11-11T18:00:00.000Z",
  overdue: true,
  student: {
    id: 21,
    name: "Kavya Nair",
    rollNo: "DEMO-H1-001",
    room: { blockCode: "A", roomNumber: "101" },
  },
  hostel: { id: 1, code: "H1", name: "North Residence Hall" },
});
const movementRecord = Object.freeze({
  id: 31,
  leaveRequestId: 12,
  movement: "exit",
  verificationMethod: "qr",
  isOverride: false,
  occurredAt: "2099-11-10T08:30:00.000Z",
  actor: { id: 4, name: "Rohan Iyer", role: "guard" },
  student: outsideRecord.student,
  hostel: outsideRecord.hostel,
});
const validVerification = Object.freeze({
  valid: true,
  code: "PASS_VALID",
  message: "Pass verified. The student may exit.",
  currentState: "approved",
  permittedAction: "exit",
  verificationMethod: "manual",
  details: {
    pass: {
      id: 8,
      leaveRequestId: 12,
      validFrom: "2099-11-10T08:00:00.000Z",
      expiresAt: "2099-11-11T18:00:00.000Z",
    },
    student: outsideRecord.student,
    hostel: outsideRecord.hostel,
  },
});

const renderTerminal = () =>
  render(<MemoryRouter><GuardTerminal /></MemoryRouter>);

describe("guard security terminal", () => {
  beforeEach(() => {
    authState.role = "guard";
    Object.values(apiMocks).forEach((mock) => mock.mockReset());
    showToast.mockReset();
    apiMocks.listOutsideRoster.mockResolvedValue({
      data: [outsideRecord],
      pagination,
      generatedAt: "2099-11-10T09:00:00.000Z",
    });
    apiMocks.listGateMovements.mockResolvedValue({
      data: [movementRecord],
      pagination,
    });
    apiMocks.verifyGatePass.mockResolvedValue(validVerification);
  });

  test("shows live roster and recent movement with minimum operational identity", async () => {
    const view = renderTerminal();

    expect(await screen.findAllByText("Kavya Nair")).not.toHaveLength(0);
    expect(screen.getByText("Students outside campus")).toBeVisible();
    expect(screen.getByText("Recent gate movements")).toBeVisible();
    expect(screen.getByText("Overdue")).toBeVisible();
    expect(screen.getByText("Rohan Iyer")).toBeVisible();
    expect(apiMocks.listOutsideRoster).toHaveBeenCalledWith({ page: 1, pageSize: 10 });
    expect(apiMocks.listGateMovements).toHaveBeenCalledWith({ page: 1, pageSize: 10 });
    await expectNoAccessibilityViolations(view.container);
  });

  test("records only the server-permitted action and reuses its retry key", async () => {
    const user = userEvent.setup();
    apiMocks.recordGateMovement
      .mockRejectedValueOnce({ response: { data: { message: "Connection interrupted." } } })
      .mockResolvedValueOnce({
        ...movementRecord,
        status: "exited",
        replayed: true,
        details: validVerification.details,
      });
    renderTerminal();
    await screen.findByText("Students outside campus");

    fireEvent.change(screen.getByLabelText("Gate-pass token"), {
      target: { value: "A".repeat(43) },
    });
    await user.click(screen.getByRole("button", { name: "Verify pass" }));
    expect(await screen.findByText("Gate pass verified")).toBeVisible();
    expect(screen.getByRole("button", { name: "Record exit" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: "Record return" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Record exit" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Connection interrupted.");
    const firstPayload = apiMocks.recordGateMovement.mock.calls[0][0];

    await user.click(screen.getByRole("button", { name: "Record exit" }));
    expect(await screen.findByText("Gate movement recorded")).toBeVisible();
    const secondPayload = apiMocks.recordGateMovement.mock.calls[1][0];
    expect(firstPayload.action).toBe("exit");
    expect(firstPayload.idempotencyKey).toBe(secondPayload.idempotencyKey);
    expect(showToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Student exit recorded" })
    );
  });

  test("invalid verification exposes no movement action", async () => {
    const user = userEvent.setup();
    apiMocks.verifyGatePass.mockResolvedValue({
      valid: false,
      code: "PASS_EXPIRED",
      message: "This gate pass has expired",
      currentState: "expired",
      permittedAction: null,
      details: null,
    });
    renderTerminal();
    await screen.findByText("Students outside campus");

    fireEvent.change(screen.getByLabelText("Gate-pass token"), {
      target: { value: "B".repeat(43) },
    });
    await user.click(screen.getByRole("button", { name: "Verify pass" }));

    expect(await screen.findByText("Gate pass expired")).toBeVisible();
    expect(screen.getByText("Action denied")).toBeVisible();
    expect(screen.queryByRole("button", { name: /Record (exit|return)/ })).not.toBeInTheDocument();
  });

  test("warden receives activity views without guard movement controls", async () => {
    authState.role = "warden";
    renderTerminal();

    expect(await screen.findByRole("heading", { name: "Gate activity" })).toBeVisible();
    expect(screen.queryByLabelText("Gate-pass token")).not.toBeInTheDocument();
    expect(screen.getByText("Students outside campus")).toBeVisible();
    expect(screen.getByText("Recent gate movements")).toBeVisible();
  });

  test("camera scan remains an alternative to manual entry", async () => {
    const user = userEvent.setup();
    renderTerminal();
    await screen.findByText("Students outside campus");

    await user.click(screen.getByRole("button", { name: "Scan QR" }));
    await user.click(screen.getByRole("button", { name: "Complete test scan" }));

    await waitFor(() => {
      expect(apiMocks.verifyGatePass).toHaveBeenCalledWith(
        `hostelmate://gate-pass/${"A".repeat(43)}`
      );
    });
  });
});
