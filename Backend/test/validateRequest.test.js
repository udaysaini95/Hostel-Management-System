import test from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import { validateRequest } from "../src/middlewares/validateRequest.js";
import {
  approvedStudentRevocationRequestSchema,
  approvedStudentSearchRequestSchema,
  loginRequestSchema,
  staffInvitationRequestSchema,
} from "../src/validation/authSchemas.js";
import {
  leaveApplicationSchema,
  menuRequestSchema,
  resourceIdSchema,
} from "../src/validation/operationalSchemas.js";
import {
  studentProfileReadRequestSchema,
  studentProfileUpdateRequestSchema,
} from "../src/validation/studentProfileSchemas.js";
import { residentDirectoryRequestSchema } from "../src/validation/residentSchemas.js";

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

test("approved-student search normalizes pagination and hostel filters", () => {
  const request = {
    query: {
      page: "2",
      pageSize: "10",
      search: "  Asha Rao  ",
      hostelCode: "h2",
      status: "activation_pending",
    },
  };

  const { response, nextCalled } = runValidation(
    approvedStudentSearchRequestSchema,
    request
  );

  assert.equal(nextCalled, true);
  assert.equal(response.statusCode, null);
  assert.deepEqual(request.query, {
    page: 2,
    pageSize: 10,
    search: "Asha Rao",
    hostelCode: "H2",
    status: "activation_pending",
  });
});

test("student-approval revocation validates both ID and reason", () => {
  const request = { params: { id: "7" }, body: { reason: "no" } };
  const { response, nextCalled } = runValidation(
    approvedStudentRevocationRequestSchema,
    request
  );

  assert.equal(nextCalled, false);
  assert.equal(response.statusCode, 422);
  assert.equal(
    response.body.fieldErrors["body.reason"],
    "Revocation reason must contain at least 5 characters"
  );
});

test("student profile updates normalize editable contact fields", () => {
  const request = {
    body: {
      phone: "  +91 98765 43210  ",
      guardianName: "  Asha Rao  ",
      guardianPhone: "  011 2345 6789 ",
    },
  };
  const { response, nextCalled } = runValidation(
    studentProfileUpdateRequestSchema,
    request
  );

  assert.equal(nextCalled, true);
  assert.equal(response.statusCode, null);
  assert.deepEqual(request.body, {
    phone: "+91 98765 43210",
    guardianName: "Asha Rao",
    guardianPhone: "011 2345 6789",
  });
});

test("student profile routes reject cross-profile selectors and identity changes", () => {
  const readRequest = { query: { userId: "42" } };
  const readResult = runValidation(
    studentProfileReadRequestSchema,
    readRequest
  );
  const updateRequest = {
    body: {
      rollNo: "NEW-ROLL-NUMBER",
      hostelCode: "H2",
    },
  };
  const updateResult = runValidation(
    studentProfileUpdateRequestSchema,
    updateRequest
  );

  assert.equal(readResult.nextCalled, false);
  assert.equal(readResult.response.statusCode, 422);
  assert.ok(readResult.response.body.fieldErrors.query);
  assert.equal(updateResult.nextCalled, false);
  assert.equal(updateResult.response.statusCode, 422);
  assert.ok(updateResult.response.body.fieldErrors.body);
});

test("student profile updates reject empty bodies and invalid phone values", () => {
  const emptyResult = runValidation(studentProfileUpdateRequestSchema, {
    body: {},
  });
  const phoneResult = runValidation(studentProfileUpdateRequestSchema, {
    body: { phone: "call-me" },
  });

  assert.equal(emptyResult.nextCalled, false);
  assert.equal(
    emptyResult.response.body.fieldErrors.body,
    "Provide at least one profile field to update"
  );
  assert.equal(phoneResult.nextCalled, false);
  assert.equal(
    phoneResult.response.body.fieldErrors["body.phone"],
    "Phone number must contain 7 to 20 valid phone characters"
  );
});

test("resident directory query validation normalizes every supported filter", () => {
  const request = {
    query: {
      page: "2",
      pageSize: "10",
      search: "  Kavya  ",
      hostelCode: "h1",
      blockCode: "a",
      roomNumber: "101",
      accountStatus: "active",
    },
  };
  const { response, nextCalled } = runValidation(
    residentDirectoryRequestSchema,
    request
  );

  assert.equal(nextCalled, true);
  assert.equal(response.statusCode, null);
  assert.deepEqual(request.query, {
    page: 2,
    pageSize: 10,
    search: "Kavya",
    hostelCode: "H1",
    blockCode: "A",
    roomNumber: "101",
    accountStatus: "active",
  });
});

test("resident directory query validation rejects unknown selectors", () => {
  const request = { query: { studentId: "42" } };
  const { response, nextCalled } = runValidation(
    residentDirectoryRequestSchema,
    request
  );

  assert.equal(nextCalled, false);
  assert.equal(response.statusCode, 422);
  assert.ok(response.body.fieldErrors.query);
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
