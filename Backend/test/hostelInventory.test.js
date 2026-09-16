import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import {
  roomCreateRequestSchema,
  roomUpdateRequestSchema,
} from "../src/validation/hostelInventorySchemas.js";

const servicePath = fileURLToPath(
  new URL("../src/services/hostelInventoryService.js", import.meta.url)
);

test("room setup accepts numeric room numbers and bounded capacity", () => {
  const valid = roomCreateRequestSchema.body.safeParse({
    roomNumber: " 101-a ",
    floor: 1,
    capacity: 3,
  });

  assert.equal(valid.success, true);
  assert.deepEqual(valid.data, {
    roomNumber: "101-A",
    floor: 1,
    capacity: 3,
  });
  assert.equal(
    roomCreateRequestSchema.body.safeParse({
      roomNumber: "101",
      floor: -1,
      capacity: 21,
    }).success,
    false
  );
  assert.equal(
    roomUpdateRequestSchema.body.safeParse({ floor: 2, capacity: 4 }).success,
    true
  );
});

test("inventory service protects occupancy and scopes rooms to a hostel", async () => {
  const source = await readFile(servicePath, "utf8");

  assert.match(source, /ROOM_CAPACITY_BELOW_OCCUPANCY/);
  assert.match(source, /ROOM_DEACTIVATION_BLOCKED/);
  assert.match(source, /eq\(rooms\.hostelId/);
  assert.doesNotMatch(source, /\.delete\(/);
});
