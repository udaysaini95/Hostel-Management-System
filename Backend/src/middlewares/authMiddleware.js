import {
  isExpiredAccessTokenError,
  verifyAccessToken,
} from "../services/accessTokenService.js";
import { sendApiError } from "../utils/apiErrors.js";

export const extractBearerToken = (authorizationHeader) => {
  if (typeof authorizationHeader !== "string") {
    return null;
  }

  return authorizationHeader.match(/^Bearer ([^\s]+)$/)?.[1] ?? null;
};

export const createProtectMiddleware = (tokenVerifier = verifyAccessToken) => {
  return (req, res, next) => {
    const token = extractBearerToken(req.headers.authorization);

    if (!token) {
      return sendApiError(
        res,
        401,
        "AUTH_TOKEN_REQUIRED",
        "A Bearer access token is required"
      );
    }

    try {
      req.user = tokenVerifier(token);
      next();
    } catch (error) {
      if (isExpiredAccessTokenError(error)) {
        return sendApiError(
          res,
          401,
          "SESSION_EXPIRED",
          "Your session has expired. Please sign in again."
        );
      }

      return sendApiError(
        res,
        401,
        "INVALID_ACCESS_TOKEN",
        "The access token is invalid"
      );
    }
  };
};

// Protect Routes (Verify JWT)
export const protect = createProtectMiddleware();
