import test from "node:test";
import assert from "node:assert/strict";
import { MAX_COMPLAINT_ATTACHMENT_BYTES } from "../src/domain/complaintAttachments.js";
import {
  complaintAttachmentUploadLimits,
  complaintResolutionUploadLimits,
} from "../src/middlewares/complaintAttachmentUpload.js";

test("private complaint uploads stay in memory with a strict boundary", () => {
  assert.deepEqual(complaintAttachmentUploadLimits, {
    fileSize: MAX_COMPLAINT_ATTACHMENT_BYTES,
    files: 1,
    fields: 0,
    parts: 1,
  });
  assert.equal(Object.isFrozen(complaintAttachmentUploadLimits), true);
});

test("resolution uploads allow one note and one optional image", () => {
  assert.deepEqual(complaintResolutionUploadLimits, {
    fileSize: MAX_COMPLAINT_ATTACHMENT_BYTES,
    files: 1,
    fields: 1,
    parts: 2,
  });
  assert.equal(Object.isFrozen(complaintResolutionUploadLimits), true);
});
