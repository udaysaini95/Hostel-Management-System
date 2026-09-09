import test from "node:test";
import assert from "node:assert/strict";
import {
  getReviewWarning,
  validateDecisionNote,
} from "../src/leave/leaveReviewView.js";

test("warden decisions require a meaningful note", () => {
  assert.match(validateDecisionNote("no"), /at least 5/);
  assert.equal(validateDecisionNote("  Student details verified  "), "");
  assert.match(validateDecisionNote("x".repeat(1001)), /must not exceed/);
});

test("overlapping active leave blocks approval while adjacent leave only warns", () => {
  const overlap = getReviewWarning({
    reviewWarnings: {
      activeRequests: [{ id: 9, overlapsSchedule: true }],
    },
  });
  const adjacent = getReviewWarning({
    reviewWarnings: {
      activeRequests: [{ id: 10, overlapsSchedule: false }],
    },
  });

  assert.equal(overlap.blocksApproval, true);
  assert.match(overlap.message, /#9/);
  assert.equal(adjacent.blocksApproval, false);
  assert.match(adjacent.message, /do not overlap/);
  assert.equal(getReviewWarning({ reviewWarnings: { activeRequests: [] } }), null);
});
