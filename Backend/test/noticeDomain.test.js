import test from "node:test";
import assert from "node:assert/strict";
import {
  NOTICE_AUDIENCE_TYPES,
  NOTICE_PRIORITIES,
  isNoticeActive,
} from "../src/domain/notices.js";

test("notice domain uses fixed audience and priority values", () => {
  assert.deepEqual(Object.values(NOTICE_AUDIENCE_TYPES), [
    "all_residents",
    "role",
    "hostel",
    "block",
  ]);
  assert.deepEqual(Object.values(NOTICE_PRIORITIES), ["normal", "important", "urgent"]);
});

test("active notices respect publication and expiry timestamps", () => {
  const now = new Date("2026-09-10T10:00:00Z");

  assert.equal(isNoticeActive({ publishedAt: "2026-09-10T09:00:00Z", expiresAt: null }, now), true);
  assert.equal(isNoticeActive({ publishedAt: "2026-09-10T09:00:00Z", expiresAt: "2026-09-10T10:00:00Z" }, now), false);
  assert.equal(isNoticeActive({ publishedAt: "2026-09-10T11:00:00Z", expiresAt: null }, now), false);
});
