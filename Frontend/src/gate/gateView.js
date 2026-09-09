const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const QR_PREFIX = "hostelmate://gate-pass/";

export const normalizeGateCredential = (value) => value.trim();

export const validateGateCredential = (value) => {
  const credential = normalizeGateCredential(value);
  const token = credential.startsWith(QR_PREFIX)
    ? credential.slice(QR_PREFIX.length)
    : credential;

  if (!TOKEN_PATTERN.test(token)) {
    return "Enter the complete 43-character pass token or scan its QR code.";
  }

  return "";
};

export const createMovementKey = (action) => {
  const randomPart = globalThis.crypto?.randomUUID?.()
    ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  return `gate-${action}-${randomPart}`;
};

export const getGateActionLabel = (action) =>
  action === "exit" ? "Record exit" : "Record return";

export const getMovementLabel = (movement) =>
  movement === "exit" ? "Exit" : "Return";

export const getRoomLabel = (room) =>
  room ? `${room.blockCode}-${room.roomNumber}` : "Room unavailable";

export const getVerificationTitle = (verification) => {
  if (verification?.valid) return "Gate pass verified";

  const titles = {
    PASS_NOT_FOUND: "Gate pass not found",
    PASS_NOT_YET_VALID: "Gate pass is not valid yet",
    PASS_EXPIRED: "Gate pass expired",
    PASS_REVOKED: "Gate pass revoked",
    LEAVE_PENDING: "Leave is awaiting approval",
    LEAVE_REJECTED: "Leave request rejected",
    LEAVE_COMPLETED: "Student already returned",
    STUDENT_ACCOUNT_INACTIVE: "Student account inactive",
    HOSTEL_INACTIVE: "Hostel inactive",
  };

  return titles[verification?.code] ?? "Gate pass cannot be used";
};
