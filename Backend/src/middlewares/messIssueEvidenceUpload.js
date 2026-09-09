import multer from "multer";
import { MAX_MESS_ISSUE_EVIDENCE_BYTES } from "../domain/messIssueEvidence.js";
import { ApiError } from "../utils/apiErrors.js";

const acceptedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

export const messIssueEvidenceUploadLimits = Object.freeze({
  fileSize: MAX_MESS_ISSUE_EVIDENCE_BYTES,
  files: 1,
  fields: 3,
  parts: 4,
});

const messIssueEvidenceUpload = multer({
  storage: multer.memoryStorage(),
  limits: messIssueEvidenceUploadLimits,
  fileFilter: (_request, file, done) => {
    if (!acceptedTypes.has(file.mimetype)) {
      done(new ApiError(
        415,
        "UNSUPPORTED_EVIDENCE_TYPE",
        "Evidence must be a JPEG, PNG, or WebP image"
      ));
      return;
    }
    done(null, true);
  },
});

export default messIssueEvidenceUpload;
