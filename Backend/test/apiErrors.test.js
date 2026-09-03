import test from "node:test";
import assert from "node:assert/strict";
import {
  ApiError,
  getPublicError,
  sendApiError,
} from "../src/utils/apiErrors.js";

const createResponse = () => ({
  statusCode: null,
  body: null,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(body) {
    this.body = body;
    return this;
  },
});

test("known application errors keep their public details", () => {
  const error = new ApiError(
    403,
    "HOSTEL_ACCESS_DENIED",
    "You cannot access this hostel"
  );

  assert.deepEqual(getPublicError(error), {
    status: 403,
    code: "HOSTEL_ACCESS_DENIED",
    message: "You cannot access this hostel",
    fieldErrors: undefined,
  });
});

test("database details are replaced with a safe conflict response", () => {
  const error = {
    code: "23505",
    detail: "Key (email)=(student@example.com) already exists",
  };

  const publicError = getPublicError(error);

  assert.deepEqual(publicError, {
    status: 409,
    code: "RESOURCE_CONFLICT",
    message: "A record with these details already exists",
  });
  assert.equal(JSON.stringify(publicError).includes(error.detail), false);
});

test("unexpected errors never expose their internal message", () => {
  const publicError = getPublicError(
    new Error("password for database user appeared here")
  );

  assert.deepEqual(publicError, {
    status: 500,
    code: "INTERNAL_SERVER_ERROR",
    message: "The request could not be completed",
  });
});

test("malformed JSON is identified without exposing parser internals", () => {
  const publicError = getPublicError({
    type: "entity.parse.failed",
    message: "Unexpected token at position 12",
  });

  assert.deepEqual(publicError, {
    status: 400,
    code: "INVALID_JSON",
    message: "The request body contains invalid JSON",
  });
});

test("field errors are included only when validation provides them", () => {
  const response = createResponse();

  sendApiError(
    response,
    422,
    "VALIDATION_ERROR",
    "Request validation failed",
    { "body.email": "Enter a valid email address" }
  );

  assert.equal(response.statusCode, 422);
  assert.deepEqual(response.body, {
    code: "VALIDATION_ERROR",
    message: "Request validation failed",
    fieldErrors: { "body.email": "Enter a valid email address" },
  });
});
