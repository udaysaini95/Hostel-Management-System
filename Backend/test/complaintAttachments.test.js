import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  MAX_COMPLAINT_ATTACHMENT_BYTES,
  inspectComplaintImage,
} from "../src/domain/complaintAttachments.js";
import { createPrivateFileStorage } from "../src/services/privateFileStorage.js";

const validPng = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x01,
]);

test("complaint image inspection accepts a real allowlisted signature", () => {
  const result = inspectComplaintImage({
    buffer: validPng,
    mimetype: "image/png",
    originalname: "C:\\fakepath\\leaking tap.png",
  });

  assert.equal(result.mimeType, "image/png");
  assert.equal(result.extension, "png");
  assert.equal(result.originalName, "leaking tap.png");
  assert.equal(result.sizeBytes, validPng.length);
});

test("complaint image inspection rejects MIME spoofing and unsafe sizes", () => {
  assert.throws(
    () =>
      inspectComplaintImage({
        buffer: Buffer.from("this is not a PNG"),
        mimetype: "image/png",
        originalname: "evidence.png",
      }),
    (error) => error.code === "INVALID_ATTACHMENT_CONTENT"
  );
  assert.throws(
    () =>
      inspectComplaintImage({
        buffer: Buffer.alloc(MAX_COMPLAINT_ATTACHMENT_BYTES + 1),
        mimetype: "image/jpeg",
        originalname: "large.jpg",
      }),
    (error) => error.code === "UPLOAD_TOO_LARGE"
  );
  assert.throws(
    () =>
      inspectComplaintImage({
        buffer: Buffer.from([0xff, 0xd8, 0xff]),
        mimetype: "image/gif",
        originalname: "evidence.gif",
      }),
    (error) => error.code === "UNSUPPORTED_ATTACHMENT_TYPE"
  );
});

test("private storage reads controlled keys and blocks path traversal", async () => {
  const rootDirectory = await mkdtemp(join(tmpdir(), "hostelmate-files-"));
  const storage = createPrivateFileStorage({ rootDirectory });
  const storageKey = "complaints/12/test-image.png";

  try {
    await storage.write(storageKey, validPng);
    assert.deepEqual(await storage.read(storageKey), validPng);
    await storage.remove(storageKey);
    await assert.rejects(storage.read(storageKey), (error) => error.code === "ENOENT");
    await assert.rejects(
      storage.write("../outside.png", validPng),
      /storage key is invalid/
    );
  } finally {
    await rm(rootDirectory, { recursive: true, force: true });
  }
});

test("private storage refuses a directory exposed by the legacy static route", () => {
  const publicChild = fileURLToPath(
    new URL("../uploads/private-evidence/", import.meta.url)
  );

  assert.throws(
    () => createPrivateFileStorage({ rootDirectory: publicChild }),
    /cannot be inside the public uploads directory/
  );
});
