import {
  hasPermission,
  isKnownPermission,
} from "../domain/permissions.js";
import { sendApiError } from "../utils/apiErrors.js";

export const requirePermission = (permission) => {
  if (!isKnownPermission(permission)) {
    throw new Error(`Unknown permission: ${permission}`);
  }

  return (req, res, next) => {
    const actorId = Number(req.user?.id);

    if (!Number.isSafeInteger(actorId) || actorId < 1) {
      return sendApiError(
        res,
        401,
        "AUTHENTICATION_REQUIRED",
        "Authentication is required"
      );
    }

    if (!hasPermission(req.user.role, permission)) {
      return sendApiError(
        res,
        403,
        "PERMISSION_DENIED",
        "You do not have permission to perform this action"
      );
    }

    return next();
  };
};
