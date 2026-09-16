import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { HostelInventoryManager } from "../../src/hostels/HostelInventoryManager.jsx";

const api = vi.hoisted(() => ({
  changeHostelRoomStatus: vi.fn(),
  createHostelRoom: vi.fn(),
  getHostelInventory: vi.fn(),
  updateHostelRoom: vi.fn(),
}));
const showToast = vi.hoisted(() => vi.fn());

vi.mock("../../src/hostels/hostelApi.js", () => api);
vi.mock("../../src/feedback/toastContext.js", () => ({
  useToast: () => ({ showToast }),
}));

const hostel = {
  id: 4,
  code: "GH1",
  name: "Gargi Residence",
  isActive: true,
};
const inventory = {
  hostel,
  rooms: [
    {
      id: 12,
      roomNumber: "101",
      floor: 1,
      capacity: 3,
      occupancy: 1,
      availableBeds: 2,
      isActive: true,
    },
  ],
};

describe("hostel room setup", () => {
  beforeEach(() => {
    Object.values(api).forEach((mock) => mock.mockReset());
    showToast.mockReset();
    api.getHostelInventory.mockResolvedValue(inventory);
  });

  test("loads rooms directly under the selected hostel", async () => {
    render(<HostelInventoryManager hostel={hostel} onClose={vi.fn()} />);

    expect(await screen.findByText("101")).toBeVisible();
    expect(screen.getByText("1/3")).toBeVisible();
  });

  test("creates a room with numeric floor and capacity values", async () => {
    const user = userEvent.setup();
    api.createHostelRoom.mockResolvedValue({ room: { id: 13 } });

    render(<HostelInventoryManager hostel={hostel} onClose={vi.fn()} />);
    expect(await screen.findByText("101")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Add room" }));
    await user.type(screen.getByLabelText("Room number"), "102");
    await user.clear(screen.getByLabelText("Floor"));
    await user.type(screen.getByLabelText("Floor"), "1");
    await user.clear(screen.getByLabelText("Bed capacity"));
    await user.type(screen.getByLabelText("Bed capacity"), "2");
    await user.click(screen.getByRole("button", { name: "Save room" }));

    await waitFor(() =>
      expect(api.createHostelRoom).toHaveBeenCalledWith(4, {
        roomNumber: "102",
        floor: 1,
        capacity: 2,
      })
    );
    expect(showToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Room created" })
    );
  });
});
