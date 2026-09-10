import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { NotificationCenter } from "../../src/notifications/NotificationCenter.jsx";
import Notices from "../../src/pages/Notices.jsx";
import { expectNoAccessibilityViolations } from "../support/accessibility.js";

const noticeApi = vi.hoisted(() => ({
  getNoticeAudienceLocations: vi.fn(),
  listManagedNotices: vi.fn(),
  listMyNotices: vi.fn(),
  markNoticeRead: vi.fn(),
  publishNotice: vi.fn(),
}));
const notificationApi = vi.hoisted(() => ({
  getNotificationUnreadCount: vi.fn(),
  listNotifications: vi.fn(),
  markAllNotificationsRead: vi.fn(),
  markNotificationRead: vi.fn(),
}));
const auth = vi.hoisted(() => ({ user: { id: 7, role: "student", name: "Aarav" } }));
const { showToast } = vi.hoisted(() => ({ showToast: vi.fn() }));

vi.mock("../../src/notices/noticeApi.js", () => noticeApi);
vi.mock("../../src/notifications/notificationApi.js", () => notificationApi);
vi.mock("../../src/auth/authContext.js", () => ({ useAuth: () => auth }));
vi.mock("../../src/feedback/toastContext.js", () => ({ useToast: () => ({ showToast }) }));

const notice = {
  id: 21,
  title: "Water supply maintenance",
  body: "The west wing supply will pause between 2 PM and 4 PM.",
  priority: "important",
  audience: {
    type: "block",
    hostel: { id: 1, code: "H1", name: "North Hall" },
    block: { id: 3, code: "B", name: "West Wing" },
  },
  publisher: { id: 2, name: "Mira Sen" },
  publishedAt: "2026-09-10T08:00:00.000Z",
  expiresAt: null,
  isActive: true,
  isRead: false,
};

const pagination = { page: 1, pageSize: 10, total: 1, totalPages: 1 };

describe("notices and notifications", () => {
  beforeEach(() => {
    Object.values(noticeApi).forEach((mock) => mock.mockReset());
    Object.values(notificationApi).forEach((mock) => mock.mockReset());
    showToast.mockReset();
    auth.user = { id: 7, role: "student", name: "Aarav" };
    noticeApi.listMyNotices.mockResolvedValue({ data: [notice], pagination });
    noticeApi.listManagedNotices.mockResolvedValue({ data: [], pagination: { ...pagination, total: 0, totalPages: 0 } });
    noticeApi.getNoticeAudienceLocations.mockResolvedValue([
      { id: 1, code: "H1", name: "North Hall", blocks: [{ id: 3, code: "B", name: "West Wing" }] },
    ]);
    noticeApi.markNoticeRead.mockResolvedValue({ noticeId: 21, isRead: true, readAt: "2026-09-10T12:00:00.000Z" });
    notificationApi.getNotificationUnreadCount.mockResolvedValue(1);
    notificationApi.listNotifications.mockResolvedValue({
      data: [{
        id: 41,
        title: "Leave approved",
        message: "Your weekend leave request was approved.",
        linkPath: "/student/leaves",
        isRead: false,
        createdAt: new Date().toISOString(),
      }],
      pagination,
    });
    notificationApi.markNotificationRead.mockResolvedValue({ notificationId: 41, isRead: true });
    notificationApi.markAllNotificationsRead.mockResolvedValue({ updatedCount: 1 });
  });

  test("student sees audience context and can mark an unread notice as read", async () => {
    const view = render(<Notices />);

    expect(await screen.findByText("Water supply maintenance")).toBeVisible();
    expect(screen.getByText("H1 · B")).toBeVisible();
    expect(within(screen.getByRole("article")).getByText("Unread")).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Mark as read" }));

    await waitFor(() => expect(noticeApi.markNoticeRead).toHaveBeenCalledWith(21));
    expect(screen.queryByRole("button", { name: "Mark as read" })).not.toBeInTheDocument();
    await expectNoAccessibilityViolations(view.container);
  });

  test("warden publishes a hostel-block notice from real location options", async () => {
    auth.user = { id: 2, role: "warden", name: "Mira" };
    noticeApi.publishNotice.mockResolvedValue({ ...notice, recipientCount: 14 });
    render(<Notices />);

    await screen.findByText("Water supply maintenance");
    await userEvent.click(screen.getByRole("button", { name: "Publish notice" }));
    await userEvent.type(screen.getByLabelText("Title"), "Quiet hours reminder");
    await userEvent.type(screen.getByLabelText("Notice details"), "Please observe quiet hours after 10 PM.");
    await userEvent.selectOptions(screen.getByLabelText("Audience"), "block");
    await waitFor(() => expect(noticeApi.getNoticeAudienceLocations).toHaveBeenCalled());
    await userEvent.selectOptions(screen.getByLabelText("Hostel"), "1");
    await userEvent.selectOptions(screen.getByLabelText("Block"), "3");
    await userEvent.click(screen.getAllByRole("button", { name: "Publish notice" })[1]);

    await waitFor(() => expect(noticeApi.publishNotice).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Quiet hours reminder",
        audience: { type: "block", hostelId: 1, blockId: 3 },
      })
    ));
  });

  test("notification bell exposes unread text and follows an authorized deep link", async () => {
    const Location = () => <span data-testid="location">{useLocation().pathname}</span>;
    const view = render(
      <MemoryRouter initialEntries={["/student/dashboard"]}>
        <NotificationCenter />
        <Routes><Route path="*" element={<Location />} /></Routes>
      </MemoryRouter>
    );

    const trigger = await screen.findByRole("button", { name: "Notifications, 1 unread" });
    await userEvent.click(trigger);
    expect(await screen.findByText("Leave approved")).toBeVisible();
    expect(screen.getByText("Unread")).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: /Leave approved/ }));

    await waitFor(() => expect(notificationApi.markNotificationRead).toHaveBeenCalledWith(41));
    expect(screen.getByTestId("location")).toHaveTextContent("/student/leaves");
    await expectNoAccessibilityViolations(view.container);
  });
});
