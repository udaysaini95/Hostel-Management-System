import multer from "multer";
import path from "path";
import { ApiError } from "../utils/apiErrors.js";

export const UPLOAD_MAX_BYTES = 5 * 1024 * 1024;
export const UPLOAD_MAX_FIELDS = 10;

export const uploadLimits = Object.freeze({
  fileSize: UPLOAD_MAX_BYTES,
  files: 1,
  fields: UPLOAD_MAX_FIELDS,
  parts: UPLOAD_MAX_FIELDS + 1,
  fieldSize: 50 * 1024,
});

const storage = multer.diskStorage({
  destination: (req, file, callback) => {
    callback(null, "uploads/");
  },
  filename: (req, file, callback) => {
    const extension = path.extname(file.originalname);
    callback(null, `${Date.now()}${extension}`);
  },
});

const fileFilter = (req, file, callback) => {
  if (file.mimetype.startsWith("image/")) {
    callback(null, true);
  } else {
    callback(
      new ApiError(
        415,
        "UNSUPPORTED_FILE_TYPE",
        "Only image uploads are supported"
      ),
      false
    );
  }
};

const upload = multer({ storage, fileFilter, limits: uploadLimits });

export default upload;
