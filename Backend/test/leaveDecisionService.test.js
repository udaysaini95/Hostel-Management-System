import test from "node:test";
import assert from "node:assert/strict";
import { normalizeLeaveDecisionInput } from "../src/services/leaveDecisionService.js";

test("leave decisions normalize the outcome and required note", () => {
  assert.deepEqual(
    normalizeLeaveDecisionInput({
      outcome: " APPROVED ",
      note: "  Dates and reason verified  ",
    }),
    {
      outcome: "approved",
      note: "Dates and reason verified",
    }
  );
});

test("leave decisions reject unknown outcomes and weak notes", () => {
  assert.throws(
    () => normalizeLeaveDecisionInput({ outcome: "pending", note: "Looks fine" }),
    (error) => error.code === "INVALID_LEAVE_DECISION"
  );
  assert.throws(
    () => normalizeLeaveDecisionInput({ outcome: "rejected", note: "No" }),
    (error) => error.code === "INVALID_LEAVE_DECISION_NOTE"
  );
});
