import test from "node:test";
import assert from "node:assert/strict";
import {
  UPLOAD_MAX_BYTES,
  UPLOAD_MAX_FIELDS,
  uploadLimits,
} from "../src/middlewares/upload.js";

test("complaint uploads have explicit resource limits", () => {
  assert.equal(UPLOAD_MAX_BYTES, 5 * 1024 * 1024);
  assert.equal(UPLOAD_MAX_FIELDS, 10);
  assert.deepEqual(uploadLimits, {
    fileSize: UPLOAD_MAX_BYTES,
    files: 1,
    fields: UPLOAD_MAX_FIELDS,
    parts: UPLOAD_MAX_FIELDS + 1,
    fieldSize: 50 * 1024,
  });
  assert.equal(Object.isFrozen(uploadLimits), true);
});
