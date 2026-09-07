import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeResolutionInput,
  normalizeVerificationInput,
  resolveComplaint,
  startComplaintWork,
  verifyComplaintResolution,
} from "../src/services/complaintResolutionService.js";

test("resolution input requires a meaningful bounded note", () => {
  assert.deepEqual(
    normalizeResolutionInput({
      resolutionNote: "  Replaced the damaged tap and checked for leaks.  ",
    }),
    { resolutionNote: "Replaced the damaged tap and checked for leaks." }
  );
  assert.throws(
    () => normalizeResolutionInput({ resolutionNote: "Fixed" }),
    (error) => error.code === "INVALID_RESOLUTION_NOTE"
  );
});

test("student verification requires a reason only when reopening", () => {
  assert.deepEqual(normalizeVerificationInput({ action: "close" }), {
    action: "close",
    reason: null,
  });
  assert.deepEqual(
    normalizeVerificationInput({
      action: " REOPEN ",
      reason: "  The leak started again this morning.  ",
    }),
    {
      action: "reopen",
      reason: "The leak started again this morning.",
    }
  );
  assert.throws(
    () => normalizeVerificationInput({ action: "reopen" }),
    (error) => error.code === "REOPEN_REASON_REQUIRED"
  );
});

test("resolution services reject missing authentication before database work", async () => {
  await assert.rejects(
    startComplaintWork(null, null, 1),
    (error) => error.code === "AUTHENTICATION_REQUIRED"
  );
  await assert.rejects(
    resolveComplaint(null, null, 1, {
      resolutionNote: "Completed the requested maintenance work.",
    }),
    (error) => error.code === "AUTHENTICATION_REQUIRED"
  );
  await assert.rejects(
    verifyComplaintResolution(null, null, 1, { action: "close" }),
    (error) => error.code === "AUTHENTICATION_REQUIRED"
  );
});
