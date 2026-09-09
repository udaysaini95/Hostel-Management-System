import test from "node:test";
import assert from "node:assert/strict";
import {
  NOTIFICATION_DESTINATIONS,
  NOTIFICATION_EVENT_TYPES,
  buildNotificationLink,
} from "../src/domain/notifications.js";

test("notification events use fixed workflow-owned values", () => {
  assert.deepEqual(Object.values(NOTIFICATION_EVENT_TYPES), [
    "complaint_reported",
    "complaint_assigned",
    "complaint_resolved",
    "leave_submitted",
    "leave_decided",
    "gate_movement",
    "important_notice",
  ]);
});

test("notification links are built from known destinations", () => {
  assert.equal(
    buildNotificationLink(NOTIFICATION_DESTINATIONS.STUDENT_COMPLAINT, 42),
    "/student/complaints/42"
  );
  assert.equal(
    buildNotificationLink(NOTIFICATION_DESTINATIONS.MANAGED_LEAVES, 7),
    "/admin/leaves"
  );
  assert.throws(() => buildNotificationLink("external_url", 1));
});
