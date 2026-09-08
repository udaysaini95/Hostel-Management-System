import test from "node:test";
import assert from "node:assert/strict";
import { secureGatePassVerificationSchema } from "../src/validation/gateSchemas.js";

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
