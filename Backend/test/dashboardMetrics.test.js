import test from "node:test";
import assert from "node:assert/strict";
import {
  DASHBOARD_DEFINITIONS,
  DASHBOARD_LINKS,
  DASHBOARD_PERIOD_DAYS,
} from "../src/domain/dashboardMetrics.js";

test("dashboard metrics keep explicit PRD definitions and bounded source links", () => {
  assert.equal(DASHBOARD_PERIOD_DAYS, 30);
  assert.match(DASHBOARD_DEFINITIONS.OPEN_COMPLAINTS, /not closed/i);
  assert.match(DASHBOARD_DEFINITIONS.SLA_BREACHED, /open complaints/i);
  assert.match(DASHBOARD_DEFINITIONS.STUDENTS_OUTSIDE, /without.*return/i);
  assert.match(DASHBOARD_DEFINITIONS.ROOM_OCCUPANCY, /allocations divided by.*capacity/i);

  for (const path of Object.values(DASHBOARD_LINKS)) {
    assert.match(path, /^\/(?!\/)[a-z0-9/-]+$/);
  }
});
