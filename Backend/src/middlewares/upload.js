import multer from "multer";
import path from "path";
import { ApiError } from "../utils/apiErrors.js";

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

const upload = multer({ storage, fileFilter });

export default upload;
