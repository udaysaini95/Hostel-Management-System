import test from "node:test";
import assert from "node:assert/strict";
import {
  createProtectMiddleware,
  extractBearerToken,
} from "../src/middlewares/authMiddleware.js";

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

test("Bearer token parsing accepts only the strict authorization format", () => {
  assert.equal(extractBearerToken("Bearer signed-token"), "signed-token");
  assert.equal(extractBearerToken("Bearer"), null);
  assert.equal(extractBearerToken("Bearer  signed-token"), null);
  assert.equal(extractBearerToken("Basic signed-token"), null);
  assert.equal(extractBearerToken(undefined), null);
});

test("authentication middleware attaches verified session claims", () => {
  const authenticatedUser = Object.freeze({
    id: 42,
    role: "student",
    email: "student.h1@hostelmate.example",
  });
  const protect = createProtectMiddleware((token) => {
    assert.equal(token, "valid-token");
    return authenticatedUser;
  });
  const request = { headers: { authorization: "Bearer valid-token" } };
  const response = createResponse();
  let nextCalled = false;

  protect(request, response, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.equal(request.user, authenticatedUser);
  assert.equal(response.statusCode, null);
});

test("authentication middleware distinguishes expired sessions", () => {
  const protect = createProtectMiddleware(() => {
    const error = new Error("expired");
    error.name = "TokenExpiredError";
    throw error;
  });
  const response = createResponse();

  protect(
    { headers: { authorization: "Bearer expired-token" } },
    response,
    () => assert.fail("Expired sessions must not call next")
  );

  assert.equal(response.statusCode, 401);
  assert.deepEqual(response.body, {
    code: "SESSION_EXPIRED",
    message: "Your session has expired. Please sign in again.",
  });
});

test("authentication middleware rejects missing and invalid tokens", async (t) => {
  await t.test("missing token", () => {
    const protect = createProtectMiddleware();
    const response = createResponse();

    protect(
      { headers: {} },
      response,
      () => assert.fail("Missing tokens must not call next")
    );

    assert.equal(response.statusCode, 401);
    assert.equal(response.body.code, "AUTH_TOKEN_REQUIRED");
  });

  await t.test("invalid token", () => {
    const protect = createProtectMiddleware(() => {
      throw new Error("invalid");
    });
    const response = createResponse();

    protect(
      { headers: { authorization: "Bearer invalid-token" } },
      response,
      () => assert.fail("Invalid tokens must not call next")
    );

    assert.equal(response.statusCode, 401);
    assert.equal(response.body.code, "INVALID_ACCESS_TOKEN");
  });
});
