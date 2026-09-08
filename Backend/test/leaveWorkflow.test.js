import test from "node:test";
import assert from "node:assert/strict";
import {
  assertLeaveTransition,
  canTransitionLeave,
  isLeaveOverdue,
  LEAVE_STATUSES,
} from "../src/domain/leaveWorkflow.js";

test("leave requests follow the approved gate-pass state machine", () => {
  assert.equal(
    canTransitionLeave(LEAVE_STATUSES.PENDING, LEAVE_STATUSES.APPROVED),
    true
  );
  assert.equal(
    canTransitionLeave(LEAVE_STATUSES.PENDING, LEAVE_STATUSES.REJECTED),
    true
  );
  assert.equal(
    canTransitionLeave(LEAVE_STATUSES.APPROVED, LEAVE_STATUSES.EXITED),
    true
  );
  assert.equal(
    canTransitionLeave(LEAVE_STATUSES.APPROVED, LEAVE_STATUSES.EXPIRED),
    true
  );
  assert.equal(
    canTransitionLeave(LEAVE_STATUSES.EXITED, LEAVE_STATUSES.RETURNED),
    true
  );
});

test("terminal and skipped leave transitions are rejected", () => {
  assert.throws(
    () =>
      assertLeaveTransition(
        LEAVE_STATUSES.PENDING,
        LEAVE_STATUSES.EXITED
      ),
    (error) =>
      error.code === "INVALID_LEAVE_TRANSITION" && error.statusCode === 409
  );
  assert.throws(
    () =>
      assertLeaveTransition(
        LEAVE_STATUSES.RETURNED,
        LEAVE_STATUSES.APPROVED
      ),
    (error) => error.code === "INVALID_LEAVE_TRANSITION"
  );
  assert.throws(
    () => assertLeaveTransition(LEAVE_STATUSES.PENDING, "outside"),
    (error) => error.code === "INVALID_LEAVE_STATUS"
  );
});

test("overdue is derived only for exited students after expected return", () => {
  const expectedReturnAt = "2026-09-10T10:00:00.000Z";

  assert.equal(
    isLeaveOverdue(
      { status: LEAVE_STATUSES.EXITED, expectedReturnAt },
      new Date("2026-09-10T10:00:01.000Z")
    ),
    true
  );
  assert.equal(
    isLeaveOverdue(
      { status: LEAVE_STATUSES.APPROVED, expectedReturnAt },
      new Date("2026-09-10T10:00:01.000Z")
    ),
    false
  );
  assert.equal(
    isLeaveOverdue(
      { status: LEAVE_STATUSES.EXITED, expectedReturnAt },
      new Date("2026-09-10T09:59:59.000Z")
    ),
    false
  );
});
