import { getPublicError, sendApiError } from "../utils/apiErrors.js";

export const notFoundHandler = (req, res) =>
  sendApiError(
    res,
    404,
    "ROUTE_NOT_FOUND",
    `No API route exists for ${req.method} ${req.originalUrl}`
  );

export const errorHandler = (error, req, res, next) => {
  if (res.headersSent) {
    return next(error);
  }

  const publicError = getPublicError(error);

  if (publicError.status >= 500) {
    console.error("Unhandled API Error:", error);
  }

  return sendApiError(
    res,
    publicError.status,
    publicError.code,
    publicError.message,
    publicError.fieldErrors
  );
};
