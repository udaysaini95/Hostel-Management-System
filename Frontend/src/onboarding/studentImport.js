export const STUDENT_IMPORT_MAX_BYTES = 1024 * 1024;
export const STUDENT_IMPORT_TEMPLATE_URL = "/student-approval-import-template.csv";

const CSV_FILE_NAME_PATTERN = /\.csv$/i;

export const validateStudentImportFile = (file) => {
  if (!file) {
    return "Choose a CSV file to review.";
  }
  if (!CSV_FILE_NAME_PATTERN.test(file.name)) {
    return "Choose a file with the .csv extension.";
  }
  if (file.size === 0) {
    return "The selected CSV file is empty.";
  }
  if (file.size > STUDENT_IMPORT_MAX_BYTES) {
    return "The CSV file must be 1 MB or smaller.";
  }

  return "";
};

export const getStudentImportReport = (error) => {
  const report = error?.response?.data?.report;

  return report && typeof report === "object" ? report : null;
};

export const getStudentImportFieldLabel = (field) => {
  const labels = {
    row: "Row",
    name: "Name",
    email: "Email",
    roll_no: "Roll number",
    hostel_code: "Hostel code",
  };

  return labels[field] ?? "Row";
};
