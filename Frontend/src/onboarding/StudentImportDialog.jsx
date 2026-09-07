import { useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Download } from "lucide-react";
import api from "../api/axios.js";
import { getApiErrorMessage } from "../api/errors.js";
import {
  Button,
  Dialog,
  Input,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "../components/ui/index.js";
import { useToast } from "../feedback/toastContext.js";
import {
  STUDENT_IMPORT_TEMPLATE_URL,
  getStudentImportFieldLabel,
  getStudentImportReport,
  validateStudentImportFile,
} from "./studentImport.js";

const IMPORT_ENDPOINT = "/api/admin/students/approvals/import";

const ReportSummary = ({ report }) => {
  const invalidRows = report.rows.filter((row) => row.status === "invalid");
  const previewRows = report.rows.slice(0, 10);

  if (invalidRows.length > 0) {
    return (
      <section
        className="hm-import__report"
        aria-labelledby="import-report-title"
      >
        <div className="hm-import__report-heading hm-import__report-heading--error">
          <AlertTriangle aria-hidden="true" />
          <div>
            <h3 id="import-report-title">
              Correct {invalidRows.length} invalid row
              {invalidRows.length === 1 ? "" : "s"}
            </h3>
            <p>
              No students were imported. Update the source file and check it
              again.
            </p>
          </div>
        </div>

        <ol className="hm-import__errors" aria-label="CSV row errors">
          {invalidRows.map((row) => (
            <li key={row.rowNumber}>
              <strong>Row {row.rowNumber}</strong>
              <span>
                {row.values.name || "Unnamed student"}
                {row.values.rollNo ? ` / ${row.values.rollNo}` : ""}
              </span>
              <ul>
                {row.errors.map((error) => (
                  <li key={`${error.field}-${error.code}`}>
                    <strong>{getStudentImportFieldLabel(error.field)}:</strong>{" "}
                    {error.message}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </section>
    );
  }

  return (
    <section
      className="hm-import__report"
      aria-labelledby="import-report-title"
    >
      <div className="hm-import__report-heading hm-import__report-heading--success">
        <CheckCircle2 aria-hidden="true" />
        <div>
          <h3 id="import-report-title">
            {report.summary.validRows} student
            {report.summary.validRows === 1 ? "" : "s"} ready
          </h3>
          <p>
            The complete file passed. Importing will create approval records
            only.
          </p>
        </div>
      </div>

      <Table caption="Validated student import preview" hideCaption>
        <TableHead>
          <TableRow>
            <TableHeaderCell>Row</TableHeaderCell>
            <TableHeaderCell>Student</TableHeaderCell>
            <TableHeaderCell>Roll number</TableHeaderCell>
            <TableHeaderCell>Hostel</TableHeaderCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {previewRows.map((row) => (
            <TableRow key={row.rowNumber}>
              <TableCell numeric>{row.rowNumber}</TableCell>
              <TableCell>
                <strong className="hm-import__student-name">
                  {row.values.name}
                </strong>
                <span className="hm-import__student-email">
                  {row.values.email}
                </span>
              </TableCell>
              <TableCell className="hm-import__mono">
                {row.values.rollNo}
              </TableCell>
              <TableCell className="hm-import__mono">
                {row.values.hostelCode}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {report.rows.length > previewRows.length && (
        <p className="hm-import__preview-note">
          Showing the first {previewRows.length} of {report.rows.length}{" "}
          validated rows.
        </p>
      )}
    </section>
  );
};

export const StudentImportDialog = ({ open, onDismiss, onImported }) => {
  const [file, setFile] = useState(null);
  const [fileError, setFileError] = useState("");
  const [requestError, setRequestError] = useState("");
  const [report, setReport] = useState(null);
  const [reviewing, setReviewing] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef(null);
  const { showToast } = useToast();
  const busy = reviewing || importing;

  const resetDialog = () => {
    setFile(null);
    setFileError("");
    setRequestError("");
    setReport(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const closeDialog = () => {
    if (busy) {
      return;
    }

    resetDialog();
    onDismiss();
  };

  const selectFile = (event) => {
    const selectedFile = event.target.files?.[0] ?? null;

    setFile(selectedFile);
    setFileError(validateStudentImportFile(selectedFile));
    setRequestError("");
    setReport(null);
  };

  const sendFile = async (dryRun) => {
    const validationError = validateStudentImportFile(file);

    if (validationError) {
      setFileError(validationError);
      window.requestAnimationFrame(() => fileInputRef.current?.focus());
      return null;
    }

    const body = new FormData();
    body.append("file", file);

    return api.post(IMPORT_ENDPOINT, body, {
      params: { dryRun },
      // Remove the JSON default so the browser can add the multipart boundary.
      headers: { "Content-Type": undefined },
    });
  };

  const reviewFile = async () => {
    try {
      setReviewing(true);
      setRequestError("");
      const response = await sendFile(true);

      if (response) {
        setReport(response.data.report);
      }
    } catch (error) {
      setReport(getStudentImportReport(error));
      setRequestError(
        getApiErrorMessage(error, "The CSV file could not be checked.")
      );
    } finally {
      setReviewing(false);
    }
  };

  const importFile = async () => {
    try {
      setImporting(true);
      setRequestError("");
      const response = await sendFile(false);

      if (!response) {
        return;
      }

      const importedRows = response.data.report.summary.importedRows;
      resetDialog();
      onImported();
      showToast({
        tone: "success",
        title: "Students imported",
        message: `${importedRows} approval record${
          importedRows === 1 ? " was" : "s were"
        } created.`,
      });
    } catch (error) {
      const latestReport = getStudentImportReport(error);
      if (latestReport) {
        setReport(latestReport);
      }
      setRequestError(
        getApiErrorMessage(error, "The student approvals could not be imported.")
      );
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog
      open={open}
      title="Import student approvals"
      description="Check the complete CSV first. Nothing is saved until every row is valid and you confirm the import."
      className="hm-import__dialog"
      dismissDisabled={busy}
      onDismiss={closeDialog}
      footer={
        <>
          <Button disabled={busy} onClick={closeDialog}>
            Cancel
          </Button>
          {report?.canImport ? (
            <Button
              variant="primary"
              loading={importing}
              loadingLabel="Importing"
              onClick={importFile}
            >
              Import {report.summary.validRows} student
              {report.summary.validRows === 1 ? "" : "s"}
            </Button>
          ) : (
            <Button
              variant="primary"
              loading={reviewing}
              loadingLabel="Checking"
              onClick={reviewFile}
            >
              Check file
            </Button>
          )}
        </>
      }
    >
      <div className="hm-import__content">
        <div className="hm-import__instructions">
          <p>Use one row per student with these exact headers:</p>
          <code>name,email,roll_no,hostel_code</code>
          <a href={STUDENT_IMPORT_TEMPLATE_URL} download>
            <Download aria-hidden="true" />
            Download CSV template
          </a>
          <small>
            Maximum 500 students and 1 MB. Hostel codes must already be active.
          </small>
        </div>

        <Input
          ref={fileInputRef}
          data-autofocus
          label="CSV file"
          name="studentImportFile"
          type="file"
          accept=".csv,text/csv"
          required
          disabled={busy}
          error={fileError}
          onChange={selectFile}
        />

        {requestError && (
          <p className="hm-import__request-error" role="alert">
            {requestError}
          </p>
        )}

        {report && <ReportSummary report={report} />}
      </div>
    </Dialog>
  );
};
