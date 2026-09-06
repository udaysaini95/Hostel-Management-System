export const ACTIVATION_REQUEST_SUCCESS_MESSAGE =
  "If the student details match an approved record, an activation email will be sent.";

export const ACTIVATION_UNAVAILABLE_MESSAGE =
  "This activation link is invalid, expired, or has already been used.";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ROLL_NO_PATTERN = /^[A-Z0-9][A-Z0-9 /-]{1,49}$/;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_BYTES = 72;

const getUtf8ByteLength = (value) => new TextEncoder().encode(value).length;

export const normalizeActivationRequest = (form) => ({
  email: form.email.trim().toLowerCase(),
  rollNo: form.rollNo.trim().replace(/\s+/g, " ").toUpperCase(),
});

export const validateActivationRequest = (form) => {
  const values = normalizeActivationRequest(form);
  const errors = {};

  if (!EMAIL_PATTERN.test(values.email) || values.email.length > 255) {
    errors.email = "Enter a valid institutional email address.";
  }

  if (!ROLL_NO_PATTERN.test(values.rollNo)) {
    errors.rollNo = "Enter a valid institutional roll number.";
  }

  return errors;
};

export const validateActivationPassword = ({ password, confirmPassword }) => {
  const errors = {};

  if (password.length < PASSWORD_MIN_LENGTH) {
    errors.password = `Use at least ${PASSWORD_MIN_LENGTH} characters.`;
  } else if (getUtf8ByteLength(password) > PASSWORD_MAX_BYTES) {
    errors.password = `Use at most ${PASSWORD_MAX_BYTES} UTF-8 bytes.`;
  }

  if (!confirmPassword) {
    errors.confirmPassword = "Enter the password again.";
  } else if (password !== confirmPassword) {
    errors.confirmPassword = "The passwords do not match.";
  }

  return errors;
};

export const isActivationTokenValid = (token) => TOKEN_PATTERN.test(token);

export const getActivationFieldErrors = (error, fields) => {
  const serverErrors = error?.response?.data?.fieldErrors ?? {};

  return Object.fromEntries(
    fields
      .map((field) => [field, serverErrors[`body.${field}`]])
      .filter(([, message]) => Boolean(message))
  );
};

export const isActivationUnavailableError = (error) =>
  error?.response?.data?.code === "ACTIVATION_UNAVAILABLE";
