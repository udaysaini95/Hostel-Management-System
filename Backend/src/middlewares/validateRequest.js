import { sendApiError } from "../utils/apiErrors.js";

const REQUEST_PARTS = ["params", "query", "body"];

const addFieldErrors = (fieldErrors, requestPart, issues) => {
  for (const issue of issues) {
    const path = [requestPart, ...issue.path].join(".");

    if (!fieldErrors[path]) {
      fieldErrors[path] = issue.message;
    }
  }
};

const setValidatedValues = (req, requestPart, values) => {
  // Express 5 exposes query through a getter, so direct assignment can fail.
  if (requestPart === "query") {
    Object.defineProperty(req, "query", {
      value: values,
      writable: true,
      configurable: true,
    });
    return;
  }

  req[requestPart] = values;
};

export const validateRequest = (schemas) => (req, res, next) => {
  const fieldErrors = {};
  const validatedValues = {};

  for (const requestPart of REQUEST_PARTS) {
    const schema = schemas[requestPart];

    if (!schema) {
      continue;
    }

    const result = schema.safeParse(req[requestPart] ?? {});

    if (!result.success) {
      addFieldErrors(fieldErrors, requestPart, result.error.issues);
      continue;
    }

    validatedValues[requestPart] = result.data;
  }

  if (Object.keys(fieldErrors).length > 0) {
    return sendApiError(
      res,
      422,
      "VALIDATION_ERROR",
      "Request validation failed",
      fieldErrors
    );
  }

  for (const [requestPart, values] of Object.entries(validatedValues)) {
    setValidatedValues(req, requestPart, values);
  }

  return next();
};
