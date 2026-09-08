import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeLeaveRequestInput,
  normalizeStudentLeaveFilters,
} from "../src/services/leaveRequestService.js";

const now = new Date("2026-10-01T08:00:00.000Z");

test("leave input is normalized with exact timestamps and emergency state", () => {
  const input = normalizeLeaveRequestInput(
    {
      reason: "  Medical appointment  ",
      departureAt: "2026-10-02T09:00:00+05:30",
      expectedReturnAt: "2026-10-02T18:00:00+05:30",
      isEmergency: true,
    },
    { now }
  );

  assert.equal(input.reason, "Medical appointment");
  assert.equal(input.departureAt.toISOString(), "2026-10-02T03:30:00.000Z");
  assert.equal(input.expectedReturnAt.toISOString(), "2026-10-02T12:30:00.000Z");
  assert.equal(input.isEmergency, true);
});

test("leave input rejects past departure and reversed ranges", () => {
  assert.throws(
    () =>
      normalizeLeaveRequestInput(
        {
          reason: "Weekend visit",
          departureAt: "2026-09-30T08:00:00Z",
          expectedReturnAt: "2026-10-02T08:00:00Z",
        },
        { now }
      ),
    (error) => error.code === "PAST_DEPARTURE_TIME" && error.statusCode === 422
  );
  assert.throws(
    () =>
      normalizeLeaveRequestInput(
        {
          reason: "Weekend visit",
          departureAt: "2026-10-03T08:00:00Z",
          expectedReturnAt: "2026-10-02T08:00:00Z",
        },
        { now }
      ),
    (error) => error.code === "INVALID_LEAVE_DATE_RANGE"
  );
});

test("student leave history filters use bounded pagination and known states", () => {
  assert.deepEqual(normalizeStudentLeaveFilters({}), {
    page: 1,
    pageSize: 10,
    status: null,
  });
  assert.deepEqual(
    normalizeStudentLeaveFilters({ page: "2", pageSize: "25", status: "returned" }),
    { page: 2, pageSize: 25, status: "returned" }
  );
  assert.throws(
    () => normalizeStudentLeaveFilters({ pageSize: 51 }),
    (error) => error.code === "INVALID_PAGE_SIZE"
  );
});
