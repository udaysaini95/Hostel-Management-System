export const EMPTY_PAGINATION = Object.freeze({
  page: 1,
  pageSize: 20,
  total: 0,
  totalPages: 0,
});

export const ACCOUNT_STATUS_OPTIONS = Object.freeze([
  { value: "", label: "All account states" },
  { value: "active", label: "Active" },
  { value: "pending", label: "Pending" },
  { value: "suspended", label: "Suspended" },
]);

const PHONE_PATTERN = /^[0-9+() -]{7,20}$/;

export const formatResidentDate = (value) => {
  if (!value) {
    return "Not recorded";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not recorded";
  }

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

export const getAccountStatusLabel = (status) => {
  switch (status) {
    case "active":
      return "Active";
    case "pending":
      return "Pending";
    case "suspended":
      return "Suspended";
    default:
      return "Unknown";
  }
};

export const getAccountStatusTone = (status) => {
  switch (status) {
    case "active":
      return "success";
    case "pending":
      return "warning";
    case "suspended":
      return "danger";
    default:
      return "neutral";
  }
};

export const validateStudentContact = (form) => {
  const errors = {};
  const phone = form.phone.trim();
  const guardianName = form.guardianName.trim();
  const guardianPhone = form.guardianPhone.trim();

  if (!PHONE_PATTERN.test(phone)) {
    errors.phone = "Enter a valid phone number using 7 to 20 characters.";
  }
  if (!guardianName) {
    errors.guardianName = "Enter the guardian's name.";
  }
  if (!PHONE_PATTERN.test(guardianPhone)) {
    errors.guardianPhone =
      "Enter a valid guardian phone number using 7 to 20 characters.";
  }

  return errors;
};

export const getStudentContactPayload = (form) => ({
  phone: form.phone.trim(),
  guardianName: form.guardianName.trim(),
  guardianPhone: form.guardianPhone.trim(),
});

export const getStudentContactFieldErrors = (error) => {
  const serverErrors = error?.response?.data?.fieldErrors ?? {};
  const fields = ["phone", "guardianName", "guardianPhone"];

  return Object.fromEntries(
    fields
      .map((field) => [field, serverErrors[`body.${field}`]])
      .filter(([, message]) => Boolean(message))
  );
};

export const normalizeResidentFilters = (filters) => ({
  search: filters.search.trim(),
  hostelCode: filters.hostelCode.trim().toUpperCase(),
  blockCode: filters.blockCode.trim().toUpperCase(),
  roomNumber: filters.roomNumber.trim().toUpperCase(),
  accountStatus: filters.accountStatus,
});

export const normalizeRoomFilters = (filters) => ({
  hostelCode: filters.hostelCode.trim().toUpperCase(),
  blockCode: filters.blockCode.trim().toUpperCase(),
  availability: filters.availability,
});

export const hasActiveFilter = (filters) =>
  Object.values(filters).some((value) => Boolean(value && value !== "all"));
