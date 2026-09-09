import { basename } from "node:path";
import { ApiError } from "../utils/apiErrors.js";

export const MAX_MESS_ISSUE_EVIDENCE_BYTES = 5 * 1024 * 1024;

const imageTypes = Object.freeze({
  "image/jpeg": {
    extension: "jpg",
    matches: (buffer) =>
      buffer.length >= 3 &&
      buffer[0] === 0xff &&
      buffer[1] === 0xd8 &&
      buffer[2] === 0xff,
  },
  "image/png": {
    extension: "png",
    matches: (buffer) =>
      buffer.length >= 8 &&
      buffer.subarray(0, 8).equals(
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
      ),
  },
  "image/webp": {
    extension: "webp",
    matches: (buffer) =>
      buffer.length >= 12 &&
      buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
      buffer.subarray(8, 12).toString("ascii") === "WEBP",
  },
});

export const inspectMessIssueEvidence = (file) => {
  if (!file?.buffer || !Buffer.isBuffer(file.buffer) || file.buffer.length === 0) {
    throw new ApiError(422, "EVIDENCE_REQUIRED", "Choose an image to attach");
  }
  if (file.buffer.length > MAX_MESS_ISSUE_EVIDENCE_BYTES) {
    throw new ApiError(413, "UPLOAD_TOO_LARGE", "Mess issue evidence must be 5 MB or smaller");
  }

  const imageType = imageTypes[file.mimetype];
  if (!imageType) {
    throw new ApiError(415, "UNSUPPORTED_EVIDENCE_TYPE", "Evidence must be a JPEG, PNG, or WebP image");
  }
  if (!imageType.matches(file.buffer)) {
    throw new ApiError(422, "INVALID_EVIDENCE_CONTENT", "The evidence content does not match its image type");
  }

  const portableName = typeof file.originalname === "string"
    ? file.originalname.replaceAll("\\", "/")
    : "";
  const originalName = basename(portableName)
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .slice(0, 255);
  if (!originalName) {
    throw new ApiError(422, "INVALID_EVIDENCE_NAME", "The evidence filename is invalid");
  }

  return Object.freeze({
    buffer: file.buffer,
    extension: imageType.extension,
    mimeType: file.mimetype,
    originalName,
    sizeBytes: file.buffer.length,
  });
};
