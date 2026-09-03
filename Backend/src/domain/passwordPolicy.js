export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_BYTES = 72;

export const isPasswordAllowed = (password) =>
  typeof password === "string" &&
  password.length >= PASSWORD_MIN_LENGTH &&
  Buffer.byteLength(password, "utf8") <= PASSWORD_MAX_BYTES;

export const PASSWORD_POLICY_MESSAGE =
  `Password must contain at least ${PASSWORD_MIN_LENGTH} characters ` +
  `and at most ${PASSWORD_MAX_BYTES} UTF-8 bytes`;
