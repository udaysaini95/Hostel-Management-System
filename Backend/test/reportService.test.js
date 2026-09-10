import test from "node:test";
import assert from "node:assert/strict";
import { REPORT_DEFINITIONS, REPORT_TYPES } from "../src/domain/reports.js";
import { resolveReportPeriod } from "../src/services/reportService.js";

const now = new Date("2026-09-10T12:00:00.000Z");

test("report periods have a visible bounded UTC default", () => {
  const period = resolveReportPeriod({}, now);

  assert.deepEqual(period.response, {
    from: "2026-08-12T12:00:00.000Z",
    to: "2026-09-10T12:00:00.000Z",
    timezone: "UTC",
    boundaries: "inclusive",
  });
});

test("report periods reject future and excessive selections", () => {
  assert.throws(
    () => resolveReportPeriod({ to: "2026-09-11T12:00:00.000Z" }, now),
    (error) => error.code === "REPORT_PERIOD_IN_FUTURE"
  );
  assert.throws(
    () => resolveReportPeriod({
      from: "2025-01-01T00:00:00.000Z",
      to: "2026-09-10T12:00:00.000Z",
    }, now),
    (error) => error.code === "REPORT_PERIOD_TOO_LARGE"
  );
});

test("every operational report publishes its calculation definitions", () => {
  for (const type of Object.values(REPORT_TYPES)) {
    assert.ok(REPORT_DEFINITIONS[type]);
    assert.ok(Object.values(REPORT_DEFINITIONS[type]).every((value) => value.length > 20));
  }
  assert.match(REPORT_DEFINITIONS.complaints.firstResolution, /first resolved event/i);
  assert.match(REPORT_DEFINITIONS.mess.average, /arithmetic mean/i);
});
