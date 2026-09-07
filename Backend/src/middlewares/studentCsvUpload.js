import multer from "multer";
import path from "node:path";
import { ApiError } from "../utils/apiErrors.js";

export const STUDENT_CSV_MAX_BYTES = 1024 * 1024;

export const studentCsvUploadLimits = Object.freeze({
  fileSize: STUDENT_CSV_MAX_BYTES,
  files: 1,
  fields: 0,
  parts: 1,
});

const supportedMimeTypes = new Set([
  "text/csv",
  "application/csv",
  "application/vnd.ms-excel",
  "application/octet-stream",
]);

const acceptCsvFile = (_request, file, callback) => {
  const extension = path.extname(file.originalname).toLowerCase();

  if (extension === ".csv" && supportedMimeTypes.has(file.mimetype)) {
    callback(null, true);
    return;
  }

  callback(
    new ApiError(
      415,
      "CSV_FILE_TYPE_REQUIRED",
      "Upload a CSV file using the HostelMate template"
    ),
    false
  );
};

export const studentCsvUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: acceptCsvFile,
  limits: studentCsvUploadLimits,
});
