export const NOTICE_PRIORITIES = Object.freeze({
  NORMAL: "normal",
  IMPORTANT: "important",
  URGENT: "urgent",
});

export const NOTICE_AUDIENCES = Object.freeze({
  ALL_RESIDENTS: "all_residents",
  ROLE: "role",
  HOSTEL: "hostel",
  BLOCK: "block",
});

const roleLabels = {
  student: "Students",
  warden: "Wardens",
  maintenance: "Maintenance staff",
  guard: "Gate security",
  admin: "Administrators",
};

export const getPriorityLabel = (priority) => ({
  normal: "Normal",
  important: "Important",
  urgent: "Urgent",
}[priority] || "Normal");

export const getPriorityTone = (priority) => ({
  important: "warning",
  urgent: "danger",
}[priority] || "neutral");

export const getAudienceLabel = (audience = {}) => {
  if (audience.type === NOTICE_AUDIENCES.ALL_RESIDENTS) return "All residents";
  if (audience.type === NOTICE_AUDIENCES.ROLE) {
    return roleLabels[audience.role] || "Selected role";
  }
  if (audience.type === NOTICE_AUDIENCES.BLOCK) {
    const hostel = audience.hostel?.code || "Hostel";
    const block = audience.block?.code || "Block";
    return `${hostel} · ${block}`;
  }
  if (audience.type === NOTICE_AUDIENCES.HOSTEL) {
    return audience.hostel?.name || audience.hostel?.code || "Selected hostel";
  }
  return "Selected audience";
};

export const formatNoticeDate = (value) => {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) return "Date unavailable";
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

export const buildNoticePayload = (form) => {
  const audience = { type: form.audienceType };
  if (form.audienceType === NOTICE_AUDIENCES.ROLE) audience.role = form.role;
  if ([NOTICE_AUDIENCES.HOSTEL, NOTICE_AUDIENCES.BLOCK].includes(form.audienceType)) {
    audience.hostelId = Number(form.hostelId);
  }
  if (form.audienceType === NOTICE_AUDIENCES.BLOCK) {
    audience.blockId = Number(form.blockId);
  }

  return {
    title: form.title.trim(),
    body: form.body.trim(),
    priority: form.priority,
    audience,
    expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : undefined,
  };
};

export const validateNoticeForm = (form) => {
  const errors = {};
  if (!form.title.trim()) errors.title = "Enter a notice title.";
  if (!form.body.trim()) errors.body = "Enter the notice details.";
  if ([NOTICE_AUDIENCES.HOSTEL, NOTICE_AUDIENCES.BLOCK].includes(form.audienceType) && !form.hostelId) {
    errors.hostelId = "Select a hostel.";
  }
  if (form.audienceType === NOTICE_AUDIENCES.BLOCK && !form.blockId) {
    errors.blockId = "Select a block.";
  }
  if (form.expiresAt && new Date(form.expiresAt) <= new Date()) {
    errors.expiresAt = "Choose a future expiry time.";
  }
  return errors;
};
