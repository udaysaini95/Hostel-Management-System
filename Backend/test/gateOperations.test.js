import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeMovementHistoryFilters,
  normalizeOutsideRosterFilters,
} from "../src/services/gateOperationsService.js";
import { normalizeGateOverrideInput } from "../src/services/gateOverrideService.js";

test("outside roster filters normalize optional values", () => {
  assert.deepEqual(normalizeOutsideRosterFilters({}), {
    page: 1,
    pageSize: 20,
    search: null,
    hostelCode: null,
    overdue: null,
  });
  assert.deepEqual(
    normalizeOutsideRosterFilters({
      page: 3,
      pageSize: 10,
      search: "  ANJALI ",
      hostelCode: " h2 ",
      overdue: false,
    }),
    {
      page: 3,
      pageSize: 10,
      search: "ANJALI",
      hostelCode: "H2",
      overdue: false,
    }
  );
});

test("movement history filters parse dates without inventing filters", () => {
  const filters = normalizeMovementHistoryFilters({
    page: 1,
    pageSize: 50,
    movement: "exit",
    overrideOnly: true,
    from: "2026-09-01T00:00:00.000Z",
  });

  assert.equal(filters.movement, "exit");
  assert.equal(filters.overrideOnly, true);
  assert.equal(filters.from.toISOString(), "2026-09-01T00:00:00.000Z");
  assert.equal(filters.to, null);
});

test("gate override input trims the audit reason", () => {
  assert.deepEqual(
    normalizeGateOverrideInput({
      leaveRequestId: "7",
      action: "exit",
      reason: "  Scanner was unavailable at the gate.  ",
      idempotencyKey: "gate-override-000007",
    }),
    {
      leaveRequestId: 7,
      action: "exit",
      reason: "Scanner was unavailable at the gate.",
      idempotencyKey: "gate-override-000007",
    }
  );
});
