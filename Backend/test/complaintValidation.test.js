import test from "node:test";
import assert from "node:assert/strict";
import {
  complaintAttachmentRequestSchema,
  complaintAssigneeListRequestSchema,
  complaintAssignmentRequestSchema,
  complaintCreateRequestSchema,
  complaintListRequestSchema,
  complaintResolutionRequestSchema,
  complaintVerificationRequestSchema,
  complaintWorkQueueRequestSchema,
} from "../src/validation/complaintSchemas.js";

test("resolution and verification requests enforce meaningful notes", () => {
  const resolution = complaintResolutionRequestSchema.body.safeParse({
    resolutionNote: "  Replaced the faulty switch and tested it.  ",
  });
  const reopen = complaintVerificationRequestSchema.body.safeParse({
    action: "reopen",
  });
  const close = complaintVerificationRequestSchema.body.safeParse({
    action: "close",
  });

  assert.equal(resolution.success, true);
  assert.equal(
    resolution.data.resolutionNote,
    "Replaced the faulty switch and tested it."
  );
  assert.equal(reopen.success, false);
  assert.equal(close.success, true);
});

test("complaint request validation normalizes the public API body", () => {
  const result = complaintCreateRequestSchema.body.safeParse({
    categoryCode: " Electrical ",
    location: "  Block A, Room 101  ",
    description: "  The ceiling light is flickering.  ",
    requestedPriority: "high",
    hostelCode: "h1",
    roomId: "5",
  });

  assert.equal(result.success, true);
  assert.deepEqual(result.data, {
    categoryCode: "electrical",
    location: "Block A, Room 101",
    description: "The ceiling light is flickering.",
    requestedPriority: "high",
    hostelCode: "H1",
    roomId: 5,
  });
});

test("assignment requests require a maintenance user and bounded reason", () => {
  const valid = complaintAssignmentRequestSchema.body.safeParse({
    assigneeUserId: "9",
    reason: "Covering the morning shift",
  });
  const unknownField = complaintAssignmentRequestSchema.body.safeParse({
    assigneeUserId: 9,
    role: "maintenance",
  });

  assert.equal(valid.success, true);
  assert.deepEqual(valid.data, {
    assigneeUserId: 9,
    reason: "Covering the morning shift",
  });
  assert.equal(unknownField.success, false);
});

test("work queue validation supports required filters and risk defaults", () => {
  const result = complaintWorkQueueRequestSchema.query.safeParse({
    priority: "high",
    status: "assigned",
    slaState: "breached",
    categoryCode: " Electrical ",
    createdFrom: "2026-09-01T00:00:00.000Z",
    createdTo: "2026-09-08T23:59:59.000Z",
  });

  assert.equal(result.success, true);
  assert.equal(result.data.sortBy, "priority");
  assert.equal(result.data.sortOrder, "asc");
  assert.equal(result.data.categoryCode, "electrical");
});

test("assignee lookup requires one valid hostel code", () => {
  assert.equal(
    complaintAssigneeListRequestSchema.query.safeParse({ hostelCode: "h1" })
      .success,
    true
  );
  assert.equal(
    complaintAssigneeListRequestSchema.query.safeParse({}).success,
    false
  );
});

test("complaint attachment validation requires both positive resource IDs", () => {
  const valid = complaintAttachmentRequestSchema.params.safeParse({
    id: "10",
    attachmentId: "4",
  });
  const invalid = complaintAttachmentRequestSchema.params.safeParse({
    id: "10",
    attachmentId: "../4",
  });

  assert.equal(valid.success, true);
  assert.deepEqual(valid.data, { id: 10, attachmentId: 4 });
  assert.equal(invalid.success, false);
});

test("complaint list validation supplies bounded pagination defaults", () => {
  const result = complaintListRequestSchema.query.safeParse({});

  assert.equal(result.success, true);
  assert.deepEqual(result.data, {
    page: 1,
    pageSize: 20,
    slaState: "all",
    sortBy: "updatedAt",
    sortOrder: "desc",
  });
});

test("complaint validation rejects arbitrary deadlines and unknown fields", () => {
  const result = complaintCreateRequestSchema.body.safeParse({
    categoryCode: "other",
    location: "Common room",
    description: "The common-room window latch is broken.",
    slaDeadline: "2099-01-01T00:00:00.000Z",
  });

  assert.equal(result.success, false);
  assert.ok(result.error.issues.some((issue) => issue.code === "unrecognized_keys"));
});
