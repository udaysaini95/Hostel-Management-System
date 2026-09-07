import test from "node:test";
import assert from "node:assert/strict";
import {
  complaintAttachmentRequestSchema,
  complaintCreateRequestSchema,
  complaintListRequestSchema,
} from "../src/validation/complaintSchemas.js";

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
    sortBy: "createdAt",
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
