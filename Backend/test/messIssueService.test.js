import test from "node:test";
import assert from "node:assert/strict";
import { inspectMessIssueEvidence } from "../src/domain/messIssueEvidence.js";
import {
  canTransitionMessIssue,
  MESS_ISSUE_STATUSES,
} from "../src/domain/messIssues.js";
import { normalizeMessIssueInput } from "../src/services/messIssueService.js";

test("mess issue input uses fixed types, meals, and a meaningful description", () => {
  assert.deepEqual(normalizeMessIssueInput({
    issueType: "food_quality",
    mealType: "lunch",
    description: "  Rice was served   cold today. ",
  }), {
    issueType: "food_quality",
    mealType: "lunch",
    description: "Rice was served cold today.",
  });
  assert.throws(
    () => normalizeMessIssueInput({ issueType: "unknown", mealType: "lunch", description: "Long enough text" }),
    { code: "INVALID_MESS_ISSUE_TYPE" }
  );
  assert.throws(
    () => normalizeMessIssueInput({ issueType: "hygiene", mealType: "lunch", description: "Short" }),
    { code: "INVALID_DESCRIPTION" }
  );
});

test("mess issues only move forward through the defined states", () => {
  assert.equal(canTransitionMessIssue("reported", "in_progress"), true);
  assert.equal(canTransitionMessIssue("in_progress", "resolved"), true);
  assert.equal(canTransitionMessIssue("reported", "resolved"), false);
  assert.equal(canTransitionMessIssue(MESS_ISSUE_STATUSES.RESOLVED, "in_progress"), false);
});

test("mess issue evidence checks both MIME type and file signature", () => {
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  assert.equal(inspectMessIssueEvidence({
    buffer: png,
    mimetype: "image/png",
    originalname: "meal.png",
  }).extension, "png");
  assert.throws(
    () => inspectMessIssueEvidence({ buffer: Buffer.from("not an image"), mimetype: "image/png", originalname: "fake.png" }),
    { code: "INVALID_EVIDENCE_CONTENT" }
  );
});
