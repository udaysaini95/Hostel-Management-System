import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { HostelInventoryManager } from "../../src/hostels/HostelInventoryManager.jsx";

const api = vi.hoisted(() => ({
  changeHostelBlockStatus: vi.fn(),
  changeHostelRoomStatus: vi.fn(),
  createHostelBlock: vi.fn(),
  createHostelRoom: vi.fn(),
  getHostelInventory: vi.fn(),
  updateHostelBlock: vi.fn(),
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
  blocks: [
    {
      id: 7,
      code: "A",
      name: "Ashoka Block",
      isActive: true,
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
    },
  ],
};

describe("hostel inventory setup", () => {
  beforeEach(() => {
    Object.values(api).forEach((mock) => mock.mockReset());
    showToast.mockReset();
    api.getHostelInventory.mockResolvedValue(inventory);
  });

  test("loads blocks and rooms, then creates a validated block", async () => {
    const user = userEvent.setup();
    api.createHostelBlock.mockResolvedValue({ block: { id: 8 } });

    render(<HostelInventoryManager hostel={hostel} onClose={vi.fn()} />);

    expect(await screen.findByText("Ashoka Block")).toBeVisible();
    expect(screen.getByText("A-101")).toBeVisible();
    expect(screen.getByText("1/3")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Add block" }));
    await user.type(screen.getByLabelText("Block code"), "b");
    await user.type(screen.getByLabelText("Block name"), "Banyan Block");
    await user.click(screen.getByRole("button", { name: "Save block" }));

    await waitFor(() =>
      expect(api.createHostelBlock).toHaveBeenCalledWith(4, {
        code: "B",
        name: "Banyan Block",
      })
    );
    expect(api.getHostelInventory).toHaveBeenCalledTimes(2);
    expect(showToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Block created" })
    );
  });

  test("creates a room with numeric floor and capacity values", async () => {
    const user = userEvent.setup();
    api.createHostelRoom.mockResolvedValue({ room: { id: 13 } });

    render(<HostelInventoryManager hostel={hostel} onClose={vi.fn()} />);
    expect(await screen.findByText("Ashoka Block")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Add room" }));
    await user.type(screen.getByLabelText("Room number"), "102");
    await user.clear(screen.getByLabelText("Floor"));
    await user.type(screen.getByLabelText("Floor"), "1");
    await user.clear(screen.getByLabelText("Bed capacity"));
    await user.type(screen.getByLabelText("Bed capacity"), "2");
    await user.click(screen.getByRole("button", { name: "Save room" }));

    await waitFor(() =>
      expect(api.createHostelRoom).toHaveBeenCalledWith(4, 7, {
        roomNumber: "102",
        floor: 1,
        capacity: 2,
      })
    );
  });
});
