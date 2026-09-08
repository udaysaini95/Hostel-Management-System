export const COMPLAINT_STATUSES = Object.freeze([
  "created",
  "assigned",
  "in_progress",
  "resolved",
  "closed",
]);

const statusLabels = Object.freeze({
  created: "Created",
  assigned: "Assigned",
  in_progress: "In progress",
  resolved: "Resolved",
  closed: "Closed",
});

const priorityLabels = Object.freeze({
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
});

const priorityTones = Object.freeze({
  critical: "danger",
  high: "warning",
  medium: "brand",
  low: "neutral",
});

export const getComplaintStatusLabel = (status) =>
  statusLabels[status] ?? "Unknown";

export const getComplaintPriorityLabel = (priority) =>
  priorityLabels[priority] ?? "Unknown";

export const getComplaintPriorityTone = (priority) =>
  priorityTones[priority] ?? "neutral";

export const formatComplaintDate = (value) => {
  const date = new Date(value);

  if (!value || Number.isNaN(date.getTime())) return "Not available";

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

export const formatFileSize = (bytes) => {
  const size = Number(bytes);
  if (!Number.isFinite(size) || size < 0) return "Unknown size";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.ceil(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

const formatDuration = (seconds) => {
  const minutes = Math.ceil(seconds / 60);
  if (minutes < 60) return `${minutes} min remaining`;

  const hours = Math.ceil(minutes / 60);
  if (hours < 48) return `${hours} hr remaining`;

  return `${Math.ceil(hours / 24)} days remaining`;
};

export const getSlaPresentation = (sla) => {
  if (!sla) return { label: "SLA unavailable", tone: "neutral" };
  if (sla.state === "completed") {
    return { label: "SLA completed", tone: "success" };
  }
  if (sla.breached || sla.state === "breached") {
    return { label: "SLA breached", tone: "danger" };
  }

  return {
    label: formatDuration(Math.max(0, Number(sla.remainingSeconds) || 0)),
    tone: "warning",
  };
};

export const validateComplaintImage = (file) => {
  if (!file) return "";

  const acceptedTypes = ["image/jpeg", "image/png", "image/webp"];
  if (!acceptedTypes.includes(file.type)) {
    return "Choose a JPEG, PNG, or WebP image.";
  }
  if (file.size > 5 * 1024 * 1024) {
    return "The image must be 5 MB or smaller.";
  }

  return "";
};

export const getComplaintFieldErrors = (error) => {
  const errors = error?.response?.data?.fieldErrors ?? {};
  const fields = {};

  for (const [path, message] of Object.entries(errors)) {
    const field = path.split(".").at(-1);
    fields[field] = message;
  }

  return fields;
};
