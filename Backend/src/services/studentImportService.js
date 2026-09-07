import { and, eq, inArray, or } from "drizzle-orm";
import {
  approvedStudents,
  hostels,
  studentProfiles,
  users,
} from "../db/schema.js";
import { ACCOUNT_STATUSES } from "../domain/accountStatuses.js";
import {
  AUDIT_ACTIONS,
  AUDIT_CATEGORIES,
  AUDIT_RESOURCE_TYPES,
} from "../domain/auditEvents.js";
import { normalizeEmail, USER_ROLES } from "../domain/roles.js";
import { ApiError } from "../utils/apiErrors.js";
import {
  appendAuditEvent,
  createAuditActorSnapshot,
} from "./auditEventService.js";

export const STUDENT_IMPORT_COLUMNS = Object.freeze([
  "name",
  "email",
  "roll_no",
  "hostel_code",
]);
export const STUDENT_IMPORT_MAX_ROWS = 500;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ROLL_NO_PATTERN = /^[A-Z0-9][A-Z0-9 /-]{1,49}$/;
const HOSTEL_CODE_PATTERN = /^[A-Z][A-Z0-9-]{0,19}$/;

const fail = (status, code, message, fieldErrors) => {
  throw new ApiError(status, code, message, fieldErrors);
};

const finishCsvRow = (records, values, lineNumber) => {
  if (values.some((value) => value.trim() !== "")) {
    records.push({ lineNumber, values });
  }
};

// The parser deliberately supports quoted commas, escaped quotes, and quoted
// line breaks. Keeping it here avoids accepting a file differently in the
// browser and on the server.
export const parseStudentImportCsv = (source) => {
  if (typeof source !== "string" || !source.trim()) {
    fail(422, "CSV_EMPTY", "The CSV file does not contain any records");
  }

  const text = source.replace(/^\uFEFF/, "");

  if (text.includes("\uFFFD")) {
    fail(
      422,
      "CSV_ENCODING_INVALID",
      "Save the CSV file using UTF-8 encoding and try again"
    );
  }

  const records = [];
  let values = [];
  let field = "";
  let inQuotes = false;
  let closedQuote = false;
  let lineNumber = 1;
  let rowLineNumber = 1;

  const finishField = () => {
    values.push(field);
    field = "";
    closedQuote = false;
  };

  const finishRow = () => {
    finishField();
    finishCsvRow(records, values, rowLineNumber);
    values = [];
    rowLineNumber = lineNumber + 1;
  };

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];

    if (inQuotes) {
      if (character === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          inQuotes = false;
          closedQuote = true;
        }
      } else if (character === "\r" || character === "\n") {
        if (character === "\r" && text[index + 1] === "\n") {
          index += 1;
        }
        field += "\n";
        lineNumber += 1;
      } else {
        field += character;
      }
      continue;
    }

    if (
      closedQuote &&
      character !== "," &&
      character !== "\r" &&
      character !== "\n"
    ) {
      fail(
        422,
        "CSV_MALFORMED",
        `Unexpected text after a quoted value on line ${lineNumber}`
      );
    }

    if (character === '"') {
      if (field.length > 0) {
        fail(
          422,
          "CSV_MALFORMED",
          `Unexpected quote on line ${lineNumber}`
        );
      }
      inQuotes = true;
    } else if (character === ",") {
      finishField();
    } else if (character === "\r" || character === "\n") {
      if (character === "\r" && text[index + 1] === "\n") {
        index += 1;
      }
      finishRow();
      lineNumber += 1;
    } else {
      field += character;
    }
  }

  if (inQuotes) {
    fail(
      422,
      "CSV_MALFORMED",
      `A quoted value starting before line ${lineNumber} is not closed`
    );
  }

  if (field.length > 0 || values.length > 0) {
    finishField();
    finishCsvRow(records, values, rowLineNumber);
  }

  if (records.length === 0) {
    fail(422, "CSV_EMPTY", "The CSV file does not contain any records");
  }

  const [headerRecord, ...dataRecords] = records;
  const headers = headerRecord.values.map((value) => value.trim().toLowerCase());
  const headerSet = new Set(headers);
  const headersAreValid =
    headers.length === STUDENT_IMPORT_COLUMNS.length &&
    headerSet.size === STUDENT_IMPORT_COLUMNS.length &&
    STUDENT_IMPORT_COLUMNS.every((column) => headerSet.has(column));

  if (!headersAreValid) {
    fail(
      422,
      "CSV_HEADER_INVALID",
      `The CSV header must contain exactly: ${STUDENT_IMPORT_COLUMNS.join(", ")}`,
      { file: "Download and use the current HostelMate CSV template" }
    );
  }

  if (dataRecords.length === 0) {
    fail(422, "CSV_NO_DATA_ROWS", "Add at least one student row to the CSV file");
  }

  if (dataRecords.length > STUDENT_IMPORT_MAX_ROWS) {
    fail(
      422,
      "CSV_ROW_LIMIT_EXCEEDED",
      `A CSV file may contain at most ${STUDENT_IMPORT_MAX_ROWS} student rows`
    );
  }

  const columnIndexes = Object.fromEntries(
    headers.map((header, index) => [header, index])
  );

  return dataRecords.map((record) => ({
    rowNumber: record.lineNumber,
    hasExpectedColumnCount: record.values.length === headers.length,
    values: {
      name: record.values[columnIndexes.name] ?? "",
      email: record.values[columnIndexes.email] ?? "",
      rollNo: record.values[columnIndexes.roll_no] ?? "",
      hostelCode: record.values[columnIndexes.hostel_code] ?? "",
    },
  }));
};

const normalizeRowValues = (values) => ({
  name: values.name.trim(),
  email: normalizeEmail(values.email),
  rollNo: values.rollNo.trim().replace(/\s+/g, " ").toUpperCase(),
  hostelCode: values.hostelCode.trim().toUpperCase(),
});

const addRowError = (row, field, code, message) => {
  if (!row.errors.some((error) => error.field === field && error.code === code)) {
    row.errors.push({ field, code, message });
  }
};

const hasFieldError = (row, field) =>
  row.errors.some((error) => error.field === field);

const addFormatErrors = (row) => {
  const { name, email, rollNo, hostelCode } = row.values;

  if (!row.hasExpectedColumnCount) {
    addRowError(
      row,
      "row",
      "COLUMN_COUNT_MISMATCH",
      "This row does not contain exactly four columns"
    );
  }
  if (name.length < 2 || name.length > 255) {
    addRowError(
      row,
      "name",
      "INVALID_NAME",
      "Name must contain between 2 and 255 characters"
    );
  }
  if (!EMAIL_PATTERN.test(email) || email.length > 255) {
    addRowError(
      row,
      "email",
      "INVALID_EMAIL",
      "Enter a valid student email address"
    );
  }
  if (!ROLL_NO_PATTERN.test(rollNo)) {
    addRowError(
      row,
      "roll_no",
      "INVALID_ROLL_NO",
      "Enter a valid student roll number"
    );
  }
  if (!HOSTEL_CODE_PATTERN.test(hostelCode)) {
    addRowError(
      row,
      "hostel_code",
      "INVALID_HOSTEL_CODE",
      "Enter a valid hostel code"
    );
  }
};

const addDuplicateErrors = (rows, valueKey, field, code, message) => {
  const groupedRows = new Map();

  for (const row of rows) {
    if (hasFieldError(row, field)) {
      continue;
    }

    const value = row.values[valueKey];
    const matchingRows = groupedRows.get(value) ?? [];
    matchingRows.push(row);
    groupedRows.set(value, matchingRows);
  }

  for (const matchingRows of groupedRows.values()) {
    if (matchingRows.length < 2) {
      continue;
    }

    for (const row of matchingRows) {
      addRowError(row, field, code, message);
    }
  }
};

const truncateForReport = (value) =>
  value.length > 120 ? `${value.slice(0, 117)}...` : value;

const toReportRow = (row) => ({
  rowNumber: row.rowNumber,
  status: row.errors.length === 0 ? "valid" : "invalid",
  values: Object.fromEntries(
    Object.entries(row.values).map(([key, value]) => [
      key,
      truncateForReport(value),
    ])
  ),
  errors: row.errors,
});

const buildReport = (rows, { dryRun, importedRows = 0 }) => {
  const invalidRows = rows.filter((row) => row.errors.length > 0).length;
  const validRows = rows.length - invalidRows;

  return {
    mode: dryRun ? "dry-run" : "import",
    canImport: rows.length > 0 && invalidRows === 0,
    summary: {
      totalRows: rows.length,
      validRows,
      invalidRows,
      importedRows,
    },
    rows: rows.map(toReportRow),
  };
};

const loadImportContext = async (database, rows) => {
  const activeHostels = await database
    .select({ id: hostels.id, code: hostels.code, name: hostels.name })
    .from(hostels)
    .where(
      and(
        inArray(hostels.code, [
          ...new Set(rows.map((row) => row.values.hostelCode)),
        ]),
        eq(hostels.isActive, true)
      )
    );
  const emails = [...new Set(rows.map((row) => row.values.email))];
  const rollNumbers = [...new Set(rows.map((row) => row.values.rollNo))];
  const existingApprovals = await database
    .select({ email: approvedStudents.email, rollNo: approvedStudents.rollNo })
    .from(approvedStudents)
    .where(
      or(
        inArray(approvedStudents.email, emails),
        inArray(approvedStudents.rollNo, rollNumbers)
      )
    );
  const existingUsers = await database
    .select({ email: users.email, rollNo: users.rollNo })
    .from(users)
    .where(or(inArray(users.email, emails), inArray(users.rollNo, rollNumbers)));
  const existingProfiles = await database
    .select({ rollNo: studentProfiles.rollNo })
    .from(studentProfiles)
    .where(inArray(studentProfiles.rollNo, rollNumbers));

  return {
    hostelsByCode: new Map(activeHostels.map((hostel) => [hostel.code, hostel])),
    approvedEmails: new Set(existingApprovals.map((record) => record.email)),
    approvedRollNumbers: new Set(
      existingApprovals.map((record) => record.rollNo)
    ),
    accountEmails: new Set(existingUsers.map((record) => record.email)),
    accountRollNumbers: new Set(
      [
        ...existingUsers.map((record) => record.rollNo),
        ...existingProfiles.map((record) => record.rollNo),
      ].filter(Boolean)
    ),
  };
};

const loadImportActor = async (database, actorId) => {
  const [actor] = await database
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      accountStatus: users.accountStatus,
    })
    .from(users)
    .where(eq(users.id, actorId))
    .limit(1);

  if (
    !actor ||
    actor.role !== USER_ROLES.ADMIN ||
    actor.accountStatus !== ACCOUNT_STATUSES.ACTIVE
  ) {
    fail(
      403,
      "STUDENT_IMPORT_ACCESS_DENIED",
      "Only an active administrator can import student approvals"
    );
  }

  return actor;
};

const addDatabaseErrors = (rows, context) => {
  for (const row of rows) {
    const { email, rollNo, hostelCode } = row.values;

    if (
      !hasFieldError(row, "hostel_code") &&
      !context.hostelsByCode.has(hostelCode)
    ) {
      addRowError(
        row,
        "hostel_code",
        "HOSTEL_NOT_FOUND",
        "No active hostel uses this code"
      );
    }
    if (!hasFieldError(row, "email") && context.approvedEmails.has(email)) {
      addRowError(
        row,
        "email",
        "EMAIL_ALREADY_APPROVED",
        "This email is already approved"
      );
    }
    if (
      !hasFieldError(row, "roll_no") &&
      context.approvedRollNumbers.has(rollNo)
    ) {
      addRowError(
        row,
        "roll_no",
        "ROLL_NO_ALREADY_APPROVED",
        "This roll number is already approved"
      );
    }
    if (!hasFieldError(row, "email") && context.accountEmails.has(email)) {
      addRowError(
        row,
        "email",
        "EMAIL_ACCOUNT_EXISTS",
        "An account already uses this email"
      );
    }
    if (
      !hasFieldError(row, "roll_no") &&
      context.accountRollNumbers.has(rollNo)
    ) {
      addRowError(
        row,
        "roll_no",
        "ROLL_NO_ACCOUNT_EXISTS",
        "An account already uses this roll number"
      );
    }
  }
};

const prepareRows = (parsedRows) => {
  const rows = parsedRows.map((row) => ({
    ...row,
    values: normalizeRowValues(row.values),
    errors: [],
  }));

  rows.forEach(addFormatErrors);
  addDuplicateErrors(
    rows,
    "email",
    "email",
    "DUPLICATE_EMAIL_IN_FILE",
    "This email appears more than once in the file"
  );
  addDuplicateErrors(
    rows,
    "rollNo",
    "roll_no",
    "DUPLICATE_ROLL_NO_IN_FILE",
    "This roll number appears more than once in the file"
  );

  return rows;
};

const getHostelCounts = (rows) =>
  Object.fromEntries(
    rows.reduce((counts, row) => {
      const code = row.values.hostelCode;
      counts.set(code, (counts.get(code) ?? 0) + 1);
      return counts;
    }, new Map())
  );

export const importStudentApprovals = async (
  database,
  csvText,
  actorId,
  { dryRun = true, now = new Date() } = {}
) => {
  const approvedByUserId = Number(actorId);

  if (!Number.isSafeInteger(approvedByUserId) || approvedByUserId < 1) {
    fail(401, "AUTHENTICATION_REQUIRED", "Authentication is required");
  }
  if (typeof dryRun !== "boolean") {
    fail(400, "INVALID_REQUEST", "Dry-run mode must be true or false");
  }
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    fail(400, "INVALID_REQUEST", "The import timestamp is invalid");
  }

  const parsedRows = parseStudentImportCsv(csvText);

  return database.transaction(async (transaction) => {
    const actor = await loadImportActor(transaction, approvedByUserId);
    const rows = prepareRows(parsedRows);
    const context = await loadImportContext(transaction, rows);
    addDatabaseErrors(rows, context);

    const preview = buildReport(rows, { dryRun });

    if (dryRun || !preview.canImport) {
      return { report: preview };
    }

    const approvals = await transaction
      .insert(approvedStudents)
      .values(
        rows.map((row) => ({
          name: row.values.name,
          email: row.values.email,
          rollNo: row.values.rollNo,
          hostelId: context.hostelsByCode.get(row.values.hostelCode).id,
          approvedByUserId,
          approvedAt: now,
          createdAt: now,
          updatedAt: now,
        }))
      )
      .returning({ id: approvedStudents.id });
    const auditActor = createAuditActorSnapshot(actor);
    const assignedHostels = [
      ...new Set(rows.map((row) => row.values.hostelCode)),
    ].map((code) => context.hostelsByCode.get(code));

    await appendAuditEvent(transaction, {
      actor: auditActor,
      category: AUDIT_CATEGORIES.STUDENT,
      action: AUDIT_ACTIONS.STUDENT_APPROVALS_IMPORTED,
      resourceType: AUDIT_RESOURCE_TYPES.STUDENT_IMPORT,
      resourceId: `${approvals[0].id}-${approvals.at(-1).id}`,
      description: `Imported ${approvals.length} student approval records`,
      metadata: {
        rowCount: approvals.length,
        hostelCounts: getHostelCounts(rows),
      },
      assignedHostels,
      createdAt: now,
    });

    return {
      report: buildReport(rows, {
        dryRun: false,
        importedRows: approvals.length,
      }),
    };
  });
};
