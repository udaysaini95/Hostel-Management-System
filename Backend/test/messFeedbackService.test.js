import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeFeedbackRange,
  normalizeMessFeedback,
} from "../src/services/messFeedbackService.js";

test("meal feedback normalizes a bounded optional comment", () => {
  assert.deepEqual(
    normalizeMessFeedback({ menuId: "12", mealType: "lunch", rating: "4", comment: "  Good dal  " }),
    { menuId: 12, mealType: "lunch", rating: 4, comment: "Good dal" }
  );
  assert.equal(
    normalizeMessFeedback({ menuId: 12, mealType: "dinner", rating: 5 }).comment,
    null
  );
});

test("meal feedback rejects invalid scores, meals, and long comments", () => {
  assert.throws(
    () => normalizeMessFeedback({ menuId: 1, mealType: "lunch", rating: 0 }),
    { code: "INVALID_RATING" }
  );
  assert.throws(
    () => normalizeMessFeedback({ menuId: 1, mealType: "midnight", rating: 4 }),
    { code: "INVALID_MEAL_TYPE" }
  );
  assert.throws(
    () => normalizeMessFeedback({ menuId: 1, mealType: "lunch", rating: 4, comment: "x".repeat(1001) }),
    { code: "COMMENT_TOO_LONG" }
  );
});

test("feedback analytics uses an ordered bounded calendar range", () => {
  assert.deepEqual(
    normalizeFeedbackRange({ from: "2026-01-01", to: "2026-12-31" }),
    { from: "2026-01-01", to: "2026-12-31" }
  );
  assert.throws(
    () => normalizeFeedbackRange({ from: "2026-09-02", to: "2026-09-01" }),
    { code: "INVALID_FEEDBACK_RANGE" }
  );
});
