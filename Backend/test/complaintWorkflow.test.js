import test from "node:test";
import assert from "node:assert/strict";
import {
  COMPLAINT_PRIORITIES,
  COMPLAINT_SLA_MINUTES,
  COMPLAINT_STATUSES,
  DEFAULT_COMPLAINT_CATEGORIES,
  assertComplaintTransition,
  canTransitionComplaint,
  getAllowedComplaintTransitions,
  getComplaintSlaDeadline,
} from "../src/domain/complaintWorkflow.js";

test("complaints follow the supported maintenance workflow", () => {
  assert.equal(
    canTransitionComplaint(
      COMPLAINT_STATUSES.CREATED,
      COMPLAINT_STATUSES.ASSIGNED
    ),
    true
  );
  assert.equal(
    canTransitionComplaint(
      COMPLAINT_STATUSES.RESOLVED,
      COMPLAINT_STATUSES.IN_PROGRESS
    ),
    true
  );
  assert.deepEqual(
    getAllowedComplaintTransitions(COMPLAINT_STATUSES.CLOSED),
    []
  );
});

test("invalid complaint transitions return a conflict error", () => {
  assert.throws(
    () =>
      assertComplaintTransition(
        COMPLAINT_STATUSES.CREATED,
        COMPLAINT_STATUSES.RESOLVED
      ),
    (error) => {
      assert.equal(error.statusCode, 409);
      assert.equal(error.code, "INVALID_COMPLAINT_TRANSITION");
      return true;
    }
  );
});

test("unknown complaint states are validation errors", () => {
  assert.throws(
    () => assertComplaintTransition("waiting", COMPLAINT_STATUSES.ASSIGNED),
    (error) => {
      assert.equal(error.statusCode, 422);
      assert.equal(error.code, "INVALID_COMPLAINT_STATUS");
      return true;
    }
  );
});

test("SLA deadlines are calculated from a server-owned priority policy", () => {
  const startedAt = new Date("2026-09-07T08:00:00.000Z");
  const deadline = getComplaintSlaDeadline(
    COMPLAINT_PRIORITIES.HIGH,
    startedAt
  );

  assert.equal(
    deadline.toISOString(),
    "2026-09-07T20:00:00.000Z"
  );
  assert.equal(
    COMPLAINT_SLA_MINUTES[COMPLAINT_PRIORITIES.CRITICAL],
    120
  );
});

test("default complaint categories carry a stable SLA snapshot", () => {
  assert.equal(DEFAULT_COMPLAINT_CATEGORIES.length, 6);
  assert.equal(
    DEFAULT_COMPLAINT_CATEGORIES.every(
      (category) =>
        category.slaMinutes === COMPLAINT_SLA_MINUTES[category.priority]
    ),
    true
  );
});
