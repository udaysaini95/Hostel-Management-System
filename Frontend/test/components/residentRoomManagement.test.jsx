import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, test, vi } from "vitest";
import api from "../../src/api/axios.js";
import ResidentRoomManagement from "../../src/pages/ResidentRoomManagement.jsx";
import { expectNoAccessibilityViolations } from "../support/accessibility.js";

const { showToast } = vi.hoisted(() => ({ showToast: vi.fn() }));

vi.mock("../../src/api/axios.js", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
  },
}));

vi.mock("../../src/feedback/toastContext.js", () => ({
  useToast: () => ({ showToast }),
}));

const residents = Object.freeze([
  {
    userId: 10,
    name: "Aanya Rao",
    email: "aanya@college.edu",
    rollNo: "2026-CSE-001",
    phone: "+91 90000 00001",
    accountStatus: "active",
    hostel: { code: "H1", name: "North Residence Hall" },
    currentAllocation: null,
    profileComplete: true,
  },
  {
    userId: 11,
    name: "Bharat Sen",
    email: "bharat@college.edu",
    rollNo: "2026-CSE-002",
    phone: "+91 90000 00002",
    accountStatus: "active",
    hostel: { code: "H1", name: "North Residence Hall" },
    currentAllocation: {
      id: 31,
      allocatedAt: "2026-09-01T10:00:00.000Z",
      block: { code: "A", name: "Ashoka Block" },
      room: { number: "101", label: "A-101", floor: 1, capacity: 2 },
    },
    profileComplete: true,
  },
]);

const rooms = Object.freeze([
  {
    id: 41,
    number: "102",
    label: "A-102",
    floor: 1,
    capacity: 2,
    occupancy: 1,
    availableBeds: 1,
    isFull: false,
    block: { id: 4, code: "A", name: "Ashoka Block" },
    hostel: { id: 1, code: "H1", name: "North Residence Hall" },
  },
]);

const page = (data) => ({
  data: {
    data,
    pagination: {
      page: 1,
      pageSize: 20,
      total: data.length,
      totalPages: data.length ? 1 : 0,
    },
  },
});

const renderPage = () =>
  render(
    <MemoryRouter>
      <ResidentRoomManagement />
    </MemoryRouter>
  );

describe("resident and room management", () => {
  beforeEach(() => {
    api.get.mockReset();
    api.post.mockReset();
    api.patch.mockReset();
    showToast.mockReset();
    api.get.mockImplementation((url) =>
      Promise.resolve(url === "/api/rooms" ? page(rooms) : page(residents))
    );
  });

  test("renders the live resident directory with accessible peer views", async () => {
    const view = renderPage();

    expect(await screen.findAllByText("Aanya Rao")).not.toHaveLength(0);
    expect(screen.getByRole("tab", { name: "Residents" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    expect(screen.getAllByRole("button", { name: "Allocate room" })).not.toHaveLength(0);
    expect(screen.getAllByRole("button", { name: "Vacate room" })).not.toHaveLength(0);
    await expectNoAccessibilityViolations(view.container);
  });

  test("allocates an available room to the selected resident", async () => {
    const user = userEvent.setup();
    api.post.mockResolvedValue({ data: { allocation: { id: 50 } } });
    renderPage();

    await screen.findAllByText("Aanya Rao");
    await user.click(
      screen.getAllByRole("button", { name: "Allocate room" })[0]
    );
    const dialog = await screen.findByRole("dialog", { name: "Allocate room" });
    await user.selectOptions(
      await within(dialog).findByLabelText("Available room"),
      "41"
    );
    await user.click(within(dialog).getByRole("button", { name: "Allocate room" }));

    expect(api.post).toHaveBeenCalledWith("/api/room-allocations", {
      studentUserId: 10,
      roomId: 41,
    });
    expect(showToast).toHaveBeenCalledWith({
      tone: "success",
      title: "Room allocated",
      message: "Aanya Rao now has an active room assignment.",
    });
  });

  test("requires a reason and vacates by active allocation ID", async () => {
    const user = userEvent.setup();
    api.patch.mockResolvedValue({ data: { allocation: { id: 31 } } });
    renderPage();

    await screen.findAllByText("Bharat Sen");
    await user.click(screen.getAllByRole("button", { name: "Vacate room" })[0]);
    const dialog = screen.getByRole("dialog", { name: "Vacate this room?" });
    await user.click(within(dialog).getByRole("button", { name: "Vacate room" }));

    expect(within(dialog).getByRole("alert")).toHaveTextContent(
      "Enter at least 5 characters"
    );
    expect(api.patch).not.toHaveBeenCalled();

    await user.type(
      within(dialog).getByLabelText("Reason for vacancy"),
      "Resident completed checkout"
    );
    await user.click(within(dialog).getByRole("button", { name: "Vacate room" }));

    expect(api.patch).toHaveBeenCalledWith(
      "/api/room-allocations/31/vacate",
      { reason: "Resident completed checkout" }
    );
    expect(showToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Room vacated" })
    );
  });

  test("loads room occupancy only when the room view is selected", async () => {
    const user = userEvent.setup();
    renderPage();

    await screen.findAllByText("Aanya Rao");
    expect(api.get).not.toHaveBeenCalledWith("/api/rooms", expect.anything());
    await user.click(screen.getByRole("tab", { name: "Room inventory" }));

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith(
        "/api/rooms",
        expect.objectContaining({
          params: expect.objectContaining({ availability: "all" }),
        })
      );
    });
    expect(screen.getByRole("tab", { name: "Room inventory" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    expect(screen.getAllByText("A-102")).not.toHaveLength(0);
    expect(screen.getAllByText("1 of 2 beds occupied")).not.toHaveLength(0);
  });

  test("shows an API error instead of a false empty directory", async () => {
    api.get.mockRejectedValue({
      response: { data: { message: "Resident service is unavailable." } },
    });
    renderPage();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Resident service is unavailable."
    );
    expect(screen.queryByText("No residents yet")).not.toBeInTheDocument();
  });
});
