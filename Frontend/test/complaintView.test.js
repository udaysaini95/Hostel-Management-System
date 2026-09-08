import test from "node:test";
import assert from "node:assert/strict";
import {
  formatFileSize,
  getComplaintStatusLabel,
  getSlaPresentation,
  validateComplaintImage,
} from "../src/complaints/complaintView.js";

test("complaint view helpers present normalized status and SLA values", () => {
  assert.equal(getComplaintStatusLabel("in_progress"), "In progress");
  assert.deepEqual(
    getSlaPresentation({ state: "breached", breached: true }),
    { label: "SLA breached", tone: "danger" }
  );
  assert.deepEqual(
    getSlaPresentation({ state: "completed", breached: false }),
    { label: "SLA completed", tone: "success" }
  );
  assert.equal(
    getSlaPresentation({ state: "active", remainingSeconds: 3600 }).label,
    "1 hr remaining"
  );
});

test("attachment helpers enforce the visible upload contract", () => {
  assert.equal(formatFileSize(1536), "2 KB");
  assert.equal(
    validateComplaintImage({ type: "application/pdf", size: 100 }),
    "Choose a JPEG, PNG, or WebP image."
  );
  assert.equal(
    validateComplaintImage({ type: "image/png", size: 5 * 1024 * 1024 + 1 }),
    "The image must be 5 MB or smaller."
  );
  assert.equal(
    validateComplaintImage({ type: "image/webp", size: 1024 }),
    ""
  );
});
