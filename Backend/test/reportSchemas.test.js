import test from "node:test";
import assert from "node:assert/strict";
import {
  complaintReportRequestSchema,
  gateReportRequestSchema,
  leaveReportRequestSchema,
  messReportRequestSchema,
} from "../src/validation/reportSchemas.js";

test("report queries normalize pagination and report-specific filters", () => {
  assert.deepEqual(
    complaintReportRequestSchema.query.parse({
      page: "2",
      pageSize: "50",
      hostelId: "4",
      status: "resolved",
      priority: "high",
    }),
    {
      page: 2,
      pageSize: 50,
      hostelId: 4,
      status: "resolved",
      priority: "high",
    }
  );
  assert.equal(leaveReportRequestSchema.query.parse({ emergency: "false" }).emergency, false);
  assert.equal(gateReportRequestSchema.query.parse({ movement: "return" }).movement, "return");
  assert.equal(messReportRequestSchema.query.parse({ mealType: "dinner" }).mealType, "dinner");
});

test("report queries reject reversed, excessive, and irrelevant filters", () => {
  assert.equal(complaintReportRequestSchema.query.safeParse({
    from: "2026-09-10T12:00:00.000Z",
    to: "2026-09-09T12:00:00.000Z",
  }).success, false);
  assert.equal(gateReportRequestSchema.query.safeParse({
    from: "2025-01-01T00:00:00.000Z",
    to: "2026-09-10T00:00:00.000Z",
  }).success, false);
  assert.equal(messReportRequestSchema.query.safeParse({ priority: "high" }).success, false);
  assert.equal(leaveReportRequestSchema.query.safeParse({ pageSize: 101 }).success, false);
});
