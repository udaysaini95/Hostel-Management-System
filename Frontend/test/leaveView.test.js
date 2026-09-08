import test from "node:test";
import assert from "node:assert/strict";
import {
  findCurrentGatePass,
  getLeaveDisplayStatus,
  toLeaveRequestPayload,
  validateLeaveForm,
} from "../src/leave/leaveView.js";

test("leave form validation checks future ordered timestamps", () => {
  const now = new Date("2026-09-09T08:00:00.000Z");
  assert.deepEqual(
    validateLeaveForm(
      {
        reason: "Family function",
        departureAt: "2026-09-10T10:00",
        expectedReturnAt: "2026-09-09T11:00",
      },
      now
    ),
    { expectedReturnAt: "Expected return must be after departure." }
  );
});

test("leave payload preserves local input as exact ISO timestamps", () => {
  const payload = toLeaveRequestPayload({
    reason: "  Family function  ",
    departureAt: "2026-09-10T10:00",
    expectedReturnAt: "2026-09-11T18:00",
    isEmergency: true,
  });

  assert.equal(payload.reason, "Family function");
  assert.equal(Number.isNaN(new Date(payload.departureAt).getTime()), false);
  assert.equal(payload.isEmergency, true);
});

test("elapsed approved passes render as expired and are not current", () => {
  const leave = {
    status: "approved",
    pass: { expiresAt: "2026-09-08T18:00:00.000Z" },
  };
  const now = new Date("2026-09-09T08:00:00.000Z");

  assert.equal(getLeaveDisplayStatus(leave, now), "expired");
  assert.equal(findCurrentGatePass([leave], now), null);
});
