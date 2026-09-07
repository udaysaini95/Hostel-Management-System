import test from "node:test";
import assert from "node:assert/strict";
import {
  STUDENT_CSV_MAX_BYTES,
  studentCsvUploadLimits,
} from "../src/middlewares/studentCsvUpload.js";

test("student CSV uploads stay in memory and have a strict size boundary", () => {
  assert.equal(STUDENT_CSV_MAX_BYTES, 1024 * 1024);
  assert.deepEqual(studentCsvUploadLimits, {
    fileSize: STUDENT_CSV_MAX_BYTES,
    files: 1,
    fields: 0,
    parts: 1,
  });
  assert.equal(Object.isFrozen(studentCsvUploadLimits), true);
});
