export const NOTICE_PRIORITIES = Object.freeze({
  NORMAL: "normal",
  IMPORTANT: "important",
  URGENT: "urgent",
});

export const NOTICE_AUDIENCES = Object.freeze({
  ALL_RESIDENTS: "all_residents",
  ROLE: "role",
  HOSTEL: "hostel",
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
  if (form.audienceType === NOTICE_AUDIENCES.HOSTEL) {
    audience.hostelId = Number(form.hostelId);
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
  if (form.audienceType === NOTICE_AUDIENCES.HOSTEL && !form.hostelId) {
    errors.hostelId = "Select a hostel.";
  }
  if (form.expiresAt && new Date(form.expiresAt) <= new Date()) {
    errors.expiresAt = "Choose a future expiry time.";
  }
  return errors;
};
