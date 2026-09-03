import { createHash, randomBytes } from "node:crypto";

export const SECURE_TOKEN_BYTES = 32;

export const createSecureToken = () =>
  randomBytes(SECURE_TOKEN_BYTES).toString("base64url");

export const hashSecureToken = (token) =>
  createHash("sha256").update(token).digest("hex");
