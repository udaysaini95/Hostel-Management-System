export const formatNotificationTime = (value, now = new Date()) => {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) return "Time unavailable";

  const elapsedMinutes = Math.max(0, Math.floor((now - date) / 60000));
  if (elapsedMinutes < 1) return "Just now";
  if (elapsedMinutes < 60) return `${elapsedMinutes}m ago`;
  if (elapsedMinutes < 1440) return `${Math.floor(elapsedMinutes / 60)}h ago`;
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(date);
};

export const groupNotifications = (notifications, now = new Date()) => {
  const recentBoundary = new Date(now);
  recentBoundary.setDate(recentBoundary.getDate() - 7);

  return notifications.reduce(
    (groups, notification) => {
      const createdAt = new Date(notification.createdAt);
      const group = !Number.isNaN(createdAt.getTime()) && createdAt >= recentBoundary
        ? "recent"
        : "earlier";
      groups[group].push(notification);
      return groups;
    },
    { recent: [], earlier: [] }
  );
};
