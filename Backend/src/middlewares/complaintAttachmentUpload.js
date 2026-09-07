import multer from "multer";
import { MAX_COMPLAINT_ATTACHMENT_BYTES } from "../domain/complaintAttachments.js";
import { ApiError } from "../utils/apiErrors.js";

const acceptedMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export const complaintAttachmentUploadLimits = Object.freeze({
  fileSize: MAX_COMPLAINT_ATTACHMENT_BYTES,
  files: 1,
  fields: 0,
  parts: 1,
});

const complaintAttachmentUpload = multer({
  storage: multer.memoryStorage(),
  limits: complaintAttachmentUploadLimits,
  fileFilter: (request, file, done) => {
    if (!acceptedMimeTypes.has(file.mimetype)) {
      done(
        new ApiError(
          415,
          "UNSUPPORTED_ATTACHMENT_TYPE",
          "Complaint evidence must be a JPEG, PNG, or WebP image"
        )
      );
      return;
    }

    done(null, true);
  },
});

export default complaintAttachmentUpload;
