import test from "node:test";
import assert from "node:assert/strict";
import { USER_ROLES } from "../src/domain/roles.js";
import { formatComplaintSlaMetrics } from "../src/services/complaintSlaService.js";

test("complaint SLA metrics expose named counts instead of ambiguous totals", () => {
  const metrics = formatComplaintSlaMetrics(
    {
      open_count: "7",
      actionable_count: "5",
      awaiting_confirmation_count: "2",
      sla_breached_count: "3",
      recorded_breach_count: "4",
      unassigned_count: "1",
      critical_count: "1",
      high_count: "2",
      medium_count: "2",
      low_count: "0",
      first_resolved_count: "4",
      within_sla_count: "3",
      after_sla_count: "1",
      average_first_resolution_minutes: "90.46",
      reopened_complaint_count: "1",
      reopen_event_count: "2",
    },
    {
      actorRole: USER_ROLES.WARDEN,
      hostelCode: "H1",
      generatedAt: new Date("2026-09-08T12:00:00.000Z"),
    }
  );

  assert.equal(metrics.scope.kind, "managed_hostels");
  assert.equal(metrics.scope.hostelCode, "H1");
  assert.deepEqual(metrics.counts.byPriority, {
    critical: 1,
    high: 2,
    medium: 2,
    low: 0,
  });
  assert.equal(metrics.resolution.compliancePercent, 75);
  assert.equal(metrics.resolution.averageFirstResolutionMinutes, 90.5);
});

test("complaint SLA compliance is null when no complaint was resolved", () => {
  const metrics = formatComplaintSlaMetrics(
    {},
    {
      actorRole: USER_ROLES.ADMIN,
      generatedAt: new Date("2026-09-08T12:00:00.000Z"),
    }
  );

  assert.equal(metrics.scope.kind, "institution");
  assert.equal(metrics.resolution.compliancePercent, null);
  assert.equal(metrics.resolution.averageFirstResolutionMinutes, null);
});
