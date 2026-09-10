import api from "../api/axios.js";

export const listNotifications = async ({ page = 1, readState = "all" } = {}) => {
  const response = await api.get("/api/notifications", {
    params: { page, pageSize: 20, readState },
  });
  return response.data;
};

export const getNotificationUnreadCount = async () => {
  const response = await api.get("/api/notifications/unread-count");
  return Number(response.data?.unreadCount) || 0;
};

export const markNotificationRead = async (notificationId) => {
  const response = await api.patch(`/api/notifications/${notificationId}/read`);
  return response.data;
};

export const markAllNotificationsRead = async () => {
  const response = await api.patch("/api/notifications/read-all");
  return response.data;
};
