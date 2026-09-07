import { basename } from "node:path";
import { ApiError } from "../utils/apiErrors.js";

export const COMPLAINT_ATTACHMENT_PURPOSES = Object.freeze({
  SUBMISSION: "submission",
  RESOLUTION: "resolution",
});

export const MAX_COMPLAINT_ATTACHMENTS = 5;
export const MAX_COMPLAINT_ATTACHMENT_BYTES = 5 * 1024 * 1024;

const fileTypes = Object.freeze({
  "image/jpeg": Object.freeze({
    extension: "jpg",
    matches: (buffer) =>
      buffer.length >= 3 &&
      buffer[0] === 0xff &&
      buffer[1] === 0xd8 &&
      buffer[2] === 0xff,
  }),
  "image/png": Object.freeze({
    extension: "png",
    matches: (buffer) =>
      buffer.length >= 8 &&
      buffer.subarray(0, 8).equals(
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
      ),
  }),
  "image/webp": Object.freeze({
    extension: "webp",
    matches: (buffer) =>
      buffer.length >= 12 &&
      buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
      buffer.subarray(8, 12).toString("ascii") === "WEBP",
  }),
});

const cleanOriginalName = (value) => {
  const portableName =
    typeof value === "string" ? value.replaceAll("\\", "/") : "";
  const name = basename(portableName)
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .slice(0, 255);

  if (!name) {
    throw new ApiError(
      422,
      "INVALID_ATTACHMENT_NAME",
      "The attachment filename is invalid"
    );
  }

  return name;
};

export const inspectComplaintImage = (file) => {
  if (
    !file?.buffer ||
    !Buffer.isBuffer(file.buffer) ||
    file.buffer.length === 0
  ) {
    throw new ApiError(
      422,
      "ATTACHMENT_REQUIRED",
      "Choose an image to attach to the complaint"
    );
  }

  if (file.buffer.length > MAX_COMPLAINT_ATTACHMENT_BYTES) {
    throw new ApiError(
      413,
      "UPLOAD_TOO_LARGE",
      "Complaint evidence must be 5 MB or smaller"
    );
  }

  const fileType = fileTypes[file.mimetype];

  if (!fileType) {
    throw new ApiError(
      415,
      "UNSUPPORTED_ATTACHMENT_TYPE",
      "Complaint evidence must be a JPEG, PNG, or WebP image"
    );
  }

  if (!fileType.matches(file.buffer)) {
    throw new ApiError(
      422,
      "INVALID_ATTACHMENT_CONTENT",
      "The attachment content does not match its image type"
    );
  }

  return Object.freeze({
    buffer: file.buffer,
    sizeBytes: file.buffer.length,
    mimeType: file.mimetype,
    extension: fileType.extension,
    originalName: cleanOriginalName(file.originalname),
  });
};
