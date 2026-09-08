import test from "node:test";
import assert from "node:assert/strict";
import {
  gateMovementRequestSchema,
  gateMovementHistoryQuerySchema,
  gateOverrideRequestSchema,
  expireGatePassesSchema,
  outsideRosterQuerySchema,
  secureGatePassVerificationSchema,
} from "../src/validation/gateSchemas.js";

test("secure gate verification accepts one bounded credential", () => {
  const result = secureGatePassVerificationSchema.body.safeParse({
    credential: `  hostelmate://gate-pass/${"A".repeat(43)}  `,
  });

  assert.equal(result.success, true);
  assert.equal(result.data.credential.startsWith("hostelmate://"), true);
});

test("outside roster validation supports pagination and overdue filtering", () => {
  const result = outsideRosterQuerySchema.query.safeParse({
    page: "2",
    pageSize: "25",
    hostelCode: "h1",
    overdue: "true",
  });

  assert.equal(result.success, true);
  assert.deepEqual(result.data, {
    page: 2,
    pageSize: 25,
    hostelCode: "H1",
    overdue: true,
  });
});

test("movement history validation rejects inverted time ranges", () => {
  const result = gateMovementHistoryQuerySchema.query.safeParse({
    from: "2026-09-09T10:00:00+05:30",
    to: "2026-09-09T09:00:00+05:30",
  });

  assert.equal(result.success, false);
});

test("gate override validation requires a reason and safe retry key", () => {
  const valid = gateOverrideRequestSchema.body.safeParse({
    leaveRequestId: "14",
    action: "return",
    reason: "Student returned after the pass scanner failed.",
    idempotencyKey: "warden-override-0001",
  });
  const shortReason = gateOverrideRequestSchema.body.safeParse({
    leaveRequestId: 14,
    action: "return",
    reason: "scanner",
    idempotencyKey: "warden-override-0002",
  });

  assert.equal(valid.success, true);
  assert.equal(shortReason.success, false);
});

test("pass expiry validation bounds each processing batch", () => {
  assert.equal(
    expireGatePassesSchema.body.safeParse({ limit: "500", hostelCode: "h2" })
      .success,
    true
  );
  assert.equal(
    expireGatePassesSchema.body.safeParse({ limit: "501" }).success,
    false
  );
});

test("secure gate verification rejects missing and additional fields", () => {
  assert.equal(
    secureGatePassVerificationSchema.body.safeParse({ credential: "" }).success,
    false
  );
  assert.equal(
    secureGatePassVerificationSchema.body.safeParse({
      credential: "A".repeat(43),
      permittedAction: "exit",
    }).success,
    false
  );
});

test("gate movement validation requires action and a safe retry key", () => {
  const valid = gateMovementRequestSchema.body.safeParse({
    credential: "A".repeat(43),
    action: "exit",
    idempotencyKey: "gate-terminal-request-0001",
  });
  const missingAction = gateMovementRequestSchema.body.safeParse({
    credential: "A".repeat(43),
    idempotencyKey: "gate-terminal-request-0002",
  });
  const unsafeKey = gateMovementRequestSchema.body.safeParse({
    credential: "A".repeat(43),
    action: "return",
    idempotencyKey: "contains spaces and symbols!",
  });

  assert.equal(valid.success, true);
  assert.equal(missingAction.success, false);
  assert.equal(unsafeKey.success, false);
});
