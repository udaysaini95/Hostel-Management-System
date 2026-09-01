import {
  hasPermission,
  isKnownPermission,
} from "../domain/permissions.js";

export const requirePermission = (permission) => {
  if (!isKnownPermission(permission)) {
    throw new Error(`Unknown permission: ${permission}`);
  }

  return (req, res, next) => {
    const actorId = Number(req.user?.id);

    if (!Number.isSafeInteger(actorId) || actorId < 1) {
      return res.status(401).json({
        code: "AUTHENTICATION_REQUIRED",
        message: "Authentication is required",
      });
    }

    if (!hasPermission(req.user.role, permission)) {
      return res.status(403).json({
        code: "PERMISSION_DENIED",
        message: "You do not have permission to perform this action",
      });
    }

    return next();
  };
};
