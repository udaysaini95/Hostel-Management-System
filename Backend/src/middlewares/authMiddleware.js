import {
  isExpiredAccessTokenError,
  verifyAccessToken,
} from "../services/accessTokenService.js";

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
      return res.status(401).json({
        code: "AUTH_TOKEN_REQUIRED",
        message: "A Bearer access token is required",
      });
    }

    try {
      req.user = tokenVerifier(token);
      next();
    } catch (error) {
      if (isExpiredAccessTokenError(error)) {
        return res.status(401).json({
          code: "SESSION_EXPIRED",
          message: "Your session has expired. Please sign in again.",
        });
      }

      return res.status(401).json({
        code: "INVALID_ACCESS_TOKEN",
        message: "The access token is invalid",
      });
    }
  };
};

// Protect Routes (Verify JWT)
export const protect = createProtectMiddleware();

// Admin Only
export const admin = (req, res, next) => {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ message: "Admin access required" });
  }
  next();
};

// Role-Based Access Control (RBAC) Middleware
export const requireRoles = (roles = []) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized: Please log in." });
    }

    // "admin" always has super access, plus check specific role
    if (req.user.role === "admin" || roles.includes(req.user.role)) {
      return next();
    }

    return res.status(403).json({
      message: `Access denied. Required roles: [${roles.join(", ")}]`,
    });
  };
};
