const DATABASE_ERROR_RESPONSES = {
  "23503": {
    status: 409,
    code: "RELATED_RECORD_CONFLICT",
    message: "The request conflicts with a related record",
  },
  "23505": {
    status: 409,
    code: "RESOURCE_CONFLICT",
    message: "A record with these details already exists",
  },
  "23514": {
    status: 422,
    code: "INVALID_RECORD",
    message: "The submitted values violate a data rule",
  },
};

export class ApiError extends Error {
  constructor(status, code, message, fieldErrors) {
    super(message);
    this.name = "ApiError";
    this.statusCode = status;
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}

export const sendApiError = (
  response,
  status,
  code,
  message,
  fieldErrors
) => {
  const body = { code, message };

  if (fieldErrors && Object.keys(fieldErrors).length > 0) {
    body.fieldErrors = fieldErrors;
  }

  return response.status(status).json(body);
};

export const getPublicError = (error) => {
  if (error instanceof ApiError) {
    return {
      status: error.statusCode,
      code: error.code,
      message: error.message,
      fieldErrors: error.fieldErrors,
    };
  }

  if (error?.type === "entity.parse.failed") {
    return {
      status: 400,
      code: "INVALID_JSON",
      message: "The request body contains invalid JSON",
    };
  }

  if (error?.type === "entity.too.large") {
    return {
      status: 413,
      code: "REQUEST_TOO_LARGE",
      message: "The request body is too large",
    };
  }

  if (error?.name === "MulterError") {
    const uploadIsTooLarge = error.code === "LIMIT_FILE_SIZE";

    return {
      status: uploadIsTooLarge ? 413 : 400,
      code: uploadIsTooLarge ? "UPLOAD_TOO_LARGE" : "INVALID_UPLOAD",
      message:
        uploadIsTooLarge
          ? "The uploaded file is too large"
          : "The uploaded file is invalid",
    };
  }

  if (DATABASE_ERROR_RESPONSES[error?.code]) {
    return DATABASE_ERROR_RESPONSES[error.code];
  }

  return {
    status: 500,
    code: "INTERNAL_SERVER_ERROR",
    message: "The request could not be completed",
  };
};

export const handleControllerError = (response, error, operation) => {
  const publicError = getPublicError(error);

  if (publicError.status >= 500) {
    console.error(`${operation}:`, error);
  }

  return sendApiError(
    response,
    publicError.status,
    publicError.code,
    publicError.message,
    publicError.fieldErrors
  );
};
