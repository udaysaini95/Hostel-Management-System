import test from "node:test";
import assert from "node:assert/strict";
import {
  gateMovementRequestSchema,
  secureGatePassVerificationSchema,
} from "../src/validation/gateSchemas.js";

test("secure gate verification accepts one bounded credential", () => {
  const result = secureGatePassVerificationSchema.body.safeParse({
    credential: `  hostelmate://gate-pass/${"A".repeat(43)}  `,
  });

  assert.equal(result.success, true);
  assert.equal(result.data.credential.startsWith("hostelmate://"), true);
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
