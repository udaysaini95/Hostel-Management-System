import test from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import { validateRequest } from "../src/middlewares/validateRequest.js";
import {
  loginRequestSchema,
  staffInvitationRequestSchema,
} from "../src/validation/authSchemas.js";
import {
  leaveApplicationSchema,
  menuRequestSchema,
  resourceIdSchema,
} from "../src/validation/operationalSchemas.js";

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

const runValidation = (schema, request) => {
  const response = createResponse();
  let nextCalled = false;

  validateRequest(schema)(request, response, () => {
    nextCalled = true;
  });

  return { response, nextCalled };
};

test("valid request data is normalized before reaching a controller", () => {
  const request = {
    body: {
      email: "  STUDENT@Example.COM ",
      password: "plain-text-password",
    },
  };

  const { response, nextCalled } = runValidation(loginRequestSchema, request);

  assert.equal(nextCalled, true);
  assert.equal(response.statusCode, null);
  assert.deepEqual(request.body, {
    email: "student@example.com",
    password: "plain-text-password",
  });
});

test("invalid request data returns field-specific errors", () => {
  const request = { body: { email: "not-an-email", password: "" } };

  const { response, nextCalled } = runValidation(loginRequestSchema, request);

  assert.equal(nextCalled, false);
  assert.equal(response.statusCode, 422);
  assert.deepEqual(response.body, {
    code: "VALIDATION_ERROR",
    message: "Request validation failed",
    fieldErrors: {
      "body.email": "Enter a valid email address",
      "body.password": "Password is required",
    },
  });
});

test("strict request schemas reject unsupported fields and staff roles", () => {
  const request = {
    body: {
      name: "Hostel Accountant",
      email: "accountant@example.com",
      role: "accountant",
      hostelCodes: ["H1"],
      canCreateAdmins: true,
    },
  };

  const { response, nextCalled } = runValidation(
    staffInvitationRequestSchema,
    request
  );

  assert.equal(nextCalled, false);
  assert.equal(response.statusCode, 422);
  assert.ok(response.body.fieldErrors["body.role"]);
  assert.ok(response.body.fieldErrors.body);
});

test("numeric route IDs are validated and converted to numbers", () => {
  const request = { params: { id: "42" } };

  const { response, nextCalled } = runValidation(resourceIdSchema, request);

  assert.equal(nextCalled, true);
  assert.equal(response.statusCode, null);
  assert.deepEqual(request.params, { id: 42 });
});

test("validated query values work with the Express 5 query getter", () => {
  const request = {};
  Object.defineProperty(request, "query", {
    configurable: true,
    get: () => ({ page: "2" }),
  });
  const schema = {
    query: z.strictObject({ page: z.coerce.number().int().positive() }),
  };

  const { response, nextCalled } = runValidation(schema, request);

  assert.equal(nextCalled, true);
  assert.equal(response.statusCode, null);
  assert.deepEqual(request.query, { page: 2 });
});

test("menu validation accepts the ISO timestamp used by the frontend", () => {
  const request = {
    body: {
      date: "2026-09-04T08:30:00.000Z",
      breakfast: ["Poha", "Tea"],
      lunch: ["Rice", "Dal"],
      dinner: ["Roti", "Paneer"],
    },
  };

  const { response, nextCalled } = runValidation(menuRequestSchema, request);

  assert.equal(nextCalled, true);
  assert.equal(response.statusCode, null);
});

test("leave dates must exist and remain in chronological order", async (t) => {
  await t.test("rejects a date that does not exist", () => {
    const request = {
      body: {
        reason: "Family event",
        fromDate: "2026-02-30",
        toDate: "2026-03-02",
      },
    };

    const { response, nextCalled } = runValidation(
      leaveApplicationSchema,
      request
    );

    assert.equal(nextCalled, false);
    assert.equal(response.body.fieldErrors["body.fromDate"], "Enter a valid date");
  });

  await t.test("rejects a return date before departure", () => {
    const request = {
      body: {
        reason: "Family event",
        fromDate: "2026-09-10",
        toDate: "2026-09-09",
      },
    };

    const { response, nextCalled } = runValidation(
      leaveApplicationSchema,
      request
    );

    assert.equal(nextCalled, false);
    assert.equal(
      response.body.fieldErrors["body.toDate"],
      "Return date cannot be before departure date"
    );
  });
});
