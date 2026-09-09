export const NOTICE_PRIORITIES = Object.freeze({
  NORMAL: "normal",
  IMPORTANT: "important",
  URGENT: "urgent",
});

export const NOTICE_AUDIENCE_TYPES = Object.freeze({
  ALL_RESIDENTS: "all_residents",
  ROLE: "role",
  HOSTEL: "hostel",
  BLOCK: "block",
});

export const NOTICE_LIST_STATES = Object.freeze({
  ACTIVE: "active",
  EXPIRED: "expired",
  ALL: "all",
});

export const NOTICE_READ_STATES = Object.freeze({
  ALL: "all",
  READ: "read",
  UNREAD: "unread",
});

export const isNoticeActive = (notice, now = new Date()) => {
  const publishedAt = new Date(notice?.publishedAt);
  const expiresAt = notice?.expiresAt ? new Date(notice.expiresAt) : null;

  return (
    !Number.isNaN(publishedAt.getTime()) &&
    publishedAt <= now &&
    (!expiresAt || expiresAt > now)
  );
};
