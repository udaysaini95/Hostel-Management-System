import test from "node:test";
import assert from "node:assert/strict";
import {
  errorHandler,
  notFoundHandler,
} from "../src/middlewares/errorMiddleware.js";

const createResponse = () => ({
  statusCode: null,
  body: null,
  headersSent: false,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(body) {
    this.body = body;
    return this;
  },
});

test("unknown API routes return a JSON error", () => {
  const response = createResponse();

  notFoundHandler(
    { method: "GET", originalUrl: "/api/not-real" },
    response
  );

  assert.equal(response.statusCode, 404);
  assert.deepEqual(response.body, {
    code: "ROUTE_NOT_FOUND",
    message: "No API route exists for GET /api/not-real",
  });
});

test("the global handler delegates after response headers are sent", () => {
  const response = createResponse();
  response.headersSent = true;
  const error = new Error("stream failed");
  let delegatedError;

  errorHandler(error, {}, response, (receivedError) => {
    delegatedError = receivedError;
  });

  assert.equal(delegatedError, error);
  assert.equal(response.statusCode, null);
});
