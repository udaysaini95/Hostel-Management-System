import test from "node:test";
import assert from "node:assert/strict";
import {
  managedNoticeListSchema,
  ownNoticeListSchema,
  publishNoticeSchema,
} from "../src/validation/noticeSchemas.js";

test("notice publication validates each audience shape", () => {
  const hostelNotice = publishNoticeSchema.body.parse({
    title: "Water maintenance",
    body: "Water supply will pause for maintenance.",
    audience: { type: "hostel", hostelId: "3" },
    expiresAt: "2026-09-12T12:00:00+05:30",
  });
  assert.equal(hostelNotice.priority, "normal");
  assert.equal(hostelNotice.audience.hostelId, 3);

  assert.throws(() => publishNoticeSchema.body.parse({
    title: "Wrong shape",
    body: "This payload mixes unrelated audience fields.",
    audience: { type: "block", hostelId: 1 },
  }));
});

test("notice list validation bounds pagination and fixed filters", () => {
  assert.deepEqual(ownNoticeListSchema.query.parse({}), {
    page: 1,
    pageSize: 10,
    state: "active",
    readState: "all",
  });
  assert.equal(managedNoticeListSchema.query.parse({ hostelId: "2" }).hostelId, 2);
  assert.throws(() => ownNoticeListSchema.query.parse({ pageSize: 51 }));
  assert.throws(() => managedNoticeListSchema.query.parse({ audienceType: "floor" }));
});
