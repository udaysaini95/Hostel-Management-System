import { rateLimit } from "express-rate-limit";
import { sendApiError } from "../utils/apiErrors.js";

export const AUTH_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
export const LOGIN_FAILURE_LIMIT = 10;
export const ACTIVATION_REQUEST_LIMIT = 5;
export const CREDENTIAL_SETUP_FAILURE_LIMIT = 10;

export const createAuthRateLimiter = ({
  limit,
  message,
  skipSuccessfulRequests = false,
  windowMs = AUTH_RATE_LIMIT_WINDOW_MS,
}) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    skipSuccessfulRequests,
    handler: (req, res) =>
      sendApiError(res, 429, "AUTH_RATE_LIMITED", message),
  });

export const loginRateLimiter = createAuthRateLimiter({
  limit: LOGIN_FAILURE_LIMIT,
  message: "Too many failed sign-in attempts. Please try again later.",
  skipSuccessfulRequests: true,
});

export const activationRequestRateLimiter = createAuthRateLimiter({
  limit: ACTIVATION_REQUEST_LIMIT,
  message: "Too many activation requests. Please try again later.",
});

export const credentialSetupRateLimiter = createAuthRateLimiter({
  limit: CREDENTIAL_SETUP_FAILURE_LIMIT,
  message: "Too many failed account setup attempts. Please try again later.",
  skipSuccessfulRequests: true,
});
