import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";
import api from "../../src/api/axios.js";
import StudentProfile from "../../src/pages/StudentProfile.jsx";
import { expectNoAccessibilityViolations } from "../support/accessibility.js";

const { showToast } = vi.hoisted(() => ({ showToast: vi.fn() }));

vi.mock("../../src/api/axios.js", () => ({
  default: {
    get: vi.fn(),
    patch: vi.fn(),
  },
}));

vi.mock("../../src/feedback/toastContext.js", () => ({
  useToast: () => ({ showToast }),
}));

const profile = Object.freeze({
  userId: 5,
  name: "Kavya Nair",
  email: "kavya@college.edu",
  accountStatus: "active",
  rollNo: "2026-CSE-042",
  phone: "+91 90000 00001",
  guardian: {
    name: "Anita Nair",
    phone: "+91 90000 00002",
  },
  hostel: {
    code: "H1",
    name: "North Residence Hall",
  },
  currentAllocation: {
    id: 25,
    allocatedAt: "2026-09-01T10:00:00.000Z",
    block: { code: "A", name: "Ashoka Block" },
    room: { number: "101", label: "A-101", floor: 1, capacity: 2 },
  },
  profileComplete: true,
  updatedAt: "2026-09-01T10:00:00.000Z",
});

describe("student profile", () => {
  beforeEach(() => {
    api.get.mockReset();
    api.patch.mockReset();
    showToast.mockReset();
    api.get.mockResolvedValue({ data: { profile } });
  });

  test("shows institutional identity and the current room", async () => {
    const view = render(<StudentProfile />);

    expect(
      await screen.findByRole("heading", { name: "Kavya Nair" })
    ).toBeVisible();
    expect(screen.getByText("2026-CSE-042")).toBeVisible();
    expect(screen.getByText("H1 — North Residence Hall")).toBeVisible();
    expect(screen.getByText("A-101")).toBeVisible();
    expect(screen.getByRole("button", { name: "Save profile" })).toBeDisabled();
    await expectNoAccessibilityViolations(view.container);
  });

  test("saves normalized contact and guardian details", async () => {
    const user = userEvent.setup();
    const updatedProfile = {
      ...profile,
      phone: "+91 98888 77777",
      updatedAt: "2026-09-07T12:00:00.000Z",
    };
    api.patch.mockResolvedValue({ data: { profile: updatedProfile } });
    render(<StudentProfile />);

    const phone = await screen.findByLabelText("Phone number");
    await user.clear(phone);
    await user.type(phone, " +91 98888 77777 ");
    await user.click(screen.getByRole("button", { name: "Save profile" }));

    expect(api.patch).toHaveBeenCalledWith("/api/student/profile", {
      phone: "+91 98888 77777",
      guardianName: "Anita Nair",
      guardianPhone: "+91 90000 00002",
    });
    expect(showToast).toHaveBeenCalledWith({
      tone: "success",
      title: "Profile updated",
      message: "Your contact and guardian details were saved.",
    });
  });

  test("keeps invalid phone input on the client and focuses the field", async () => {
    const user = userEvent.setup();
    render(<StudentProfile />);

    const phone = await screen.findByLabelText("Phone number");
    await user.clear(phone);
    await user.type(phone, "123");
    await user.click(screen.getByRole("button", { name: "Save profile" }));

    expect(phone).toHaveFocus();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Enter a valid phone number"
    );
    expect(api.patch).not.toHaveBeenCalled();
  });

  test("shows a retryable error instead of an empty profile", async () => {
    api.get.mockRejectedValue({
      response: { data: { message: "Profile service is unavailable." } },
    });
    render(<StudentProfile />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Profile service is unavailable."
    );
    expect(screen.getByRole("button", { name: "Try again" })).toBeVisible();
    expect(screen.queryByText("Not allocated")).not.toBeInTheDocument();
  });
});
