import test from "node:test";
import assert from "node:assert/strict";
import { PERMISSIONS } from "../src/domain/permissions.js";
import { USER_ROLES } from "../src/domain/roles.js";
import { requirePermission } from "../src/middlewares/authorizationMiddleware.js";

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

test("permission middleware rejects unknown permissions during route setup", () => {
  assert.throws(
    () => requirePermission("unknown:permission"),
    /Unknown permission/
  );
});

test("permission middleware requires an authenticated actor", () => {
  const authorize = requirePermission(PERMISSIONS.PROFILE_READ_SELF);
  const response = createResponse();

  authorize({}, response, () => assert.fail("Unauthenticated access must fail"));

  assert.equal(response.statusCode, 401);
  assert.equal(response.body.code, "AUTHENTICATION_REQUIRED");
});

test("permission middleware rejects role claims without a valid subject", () => {
  const authorize = requirePermission(PERMISSIONS.STAFF_PROVISION);
  const response = createResponse();

  authorize(
    { user: { role: USER_ROLES.ADMIN } },
    response,
    () => assert.fail("Role-only claims must not authorize requests")
  );

  assert.equal(response.statusCode, 401);
  assert.equal(response.body.code, "AUTHENTICATION_REQUIRED");
});

test("permission middleware rejects known roles without the permission", () => {
  const authorize = requirePermission(PERMISSIONS.LEAVE_REVIEW);
  const response = createResponse();

  authorize(
    { user: { id: 1, role: USER_ROLES.STUDENT } },
    response,
    () => assert.fail("Unauthorized roles must not call next")
  );

  assert.equal(response.statusCode, 403);
  assert.equal(response.body.code, "PERMISSION_DENIED");
});

test("permission middleware permits roles granted the requested capability", () => {
  const authorize = requirePermission(PERMISSIONS.LEAVE_REVIEW);
  const response = createResponse();
  let nextCalled = false;

  authorize(
    { user: { id: 1, role: USER_ROLES.WARDEN } },
    response,
    () => {
      nextCalled = true;
    }
  );

  assert.equal(nextCalled, true);
  assert.equal(response.statusCode, null);
});
