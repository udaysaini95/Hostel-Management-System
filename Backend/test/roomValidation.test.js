import test from "node:test";
import assert from "node:assert/strict";
import {
  createRoomAllocationRequestSchema,
  roomInventoryRequestSchema,
  transferRoomAllocationRequestSchema,
  vacateRoomAllocationRequestSchema,
} from "../src/validation/roomSchemas.js";

test("room inventory validation normalizes supported query values", () => {
  const result = roomInventoryRequestSchema.query.parse({
    page: "2",
    pageSize: "10",
    hostelCode: " h1 ",
    blockCode: " a ",
    availability: "available",
  });

  assert.deepEqual(result, {
    page: 2,
    pageSize: 10,
    hostelCode: "H1",
    blockCode: "A",
    availability: "available",
  });
});

test("transfer validation requires allocation and room IDs plus a reason", () => {
  const valid = {
    params: transferRoomAllocationRequestSchema.params.safeParse({ id: "15" }),
    body: transferRoomAllocationRequestSchema.body.safeParse({
      roomId: 8,
      reason: "Approved accessibility request",
    }),
  };

  assert.equal(valid.params.success, true);
  assert.equal(valid.params.data.id, 15);
  assert.equal(valid.body.success, true);
  assert.equal(
    transferRoomAllocationRequestSchema.body.safeParse({
      roomId: 8,
      reason: "move",
    }).success,
    false
  );
  assert.equal(
    transferRoomAllocationRequestSchema.body.safeParse({
      roomId: "8",
      reason: "Approved accessibility request",
    }).success,
    false
  );
});

test("allocation validation requires numeric identifiers and rejects extra fields", () => {
  assert.equal(
    createRoomAllocationRequestSchema.body.safeParse({
      studentUserId: 10,
      roomId: 4,
    }).success,
    true
  );
  assert.equal(
    createRoomAllocationRequestSchema.body.safeParse({
      studentUserId: "10",
      roomId: 4,
    }).success,
    false
  );
  assert.equal(
    createRoomAllocationRequestSchema.body.safeParse({
      studentUserId: 10,
      roomId: 4,
      capacity: 99,
    }).success,
    false
  );
});

test("vacancy validation requires an allocation ID and meaningful reason", () => {
  const valid = {
    params: vacateRoomAllocationRequestSchema.params.safeParse({ id: "15" }),
    body: vacateRoomAllocationRequestSchema.body.safeParse({
      reason: "Resident completed checkout",
    }),
  };

  assert.equal(valid.params.success, true);
  assert.equal(valid.params.data.id, 15);
  assert.equal(valid.body.success, true);
  assert.equal(
    vacateRoomAllocationRequestSchema.body.safeParse({ reason: "left" })
      .success,
    false
  );
});
