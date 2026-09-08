import test from "node:test";
import assert from "node:assert/strict";
import { normalizeMovementInput } from "../src/services/gateMovementService.js";

test("gate movement input keeps one explicit action and retry key", () => {
  assert.deepEqual(
    normalizeMovementInput({
      credential: `  ${"A".repeat(43)}  `,
      action: "exit",
      idempotencyKey: "gate-terminal-request-0001",
      note: "  Student identity checked  ",
    }),
    {
      credential: "A".repeat(43),
      action: "exit",
      idempotencyKey: "gate-terminal-request-0001",
      note: "Student identity checked",
    }
  );
});

test("gate movement input rejects unsafe actions and retry keys", () => {
  assert.throws(
    () =>
      normalizeMovementInput({
        credential: "A".repeat(43),
        action: "ENTRY",
        idempotencyKey: "gate-terminal-request-0002",
      }),
    (error) => error.code === "INVALID_GATE_ACTION"
  );
  assert.throws(
    () =>
      normalizeMovementInput({
        credential: "A".repeat(43),
        action: "return",
        idempotencyKey: "short",
      }),
    (error) => error.code === "INVALID_IDEMPOTENCY_KEY"
  );
});
