import test from "node:test";
import assert from "node:assert/strict";
import {
  STUDENT_IMPORT_COLUMNS,
  STUDENT_IMPORT_MAX_ROWS,
  importStudentApprovals,
  parseStudentImportCsv,
} from "../src/services/studentImportService.js";
import { studentApprovalImportRequestSchema } from "../src/validation/authSchemas.js";

test("CSV parser accepts UTF-8 BOM, reordered columns, commas, and escaped quotes", () => {
  const rows = parseStudentImportCsv(
    '\uFEFFemail,name,hostel_code,roll_no\r\nasha@example.edu,"Rao, Asha",h1,2026-cse-001\r\n' +
      'kabir@example.edu,"Kabir ""K"" Sen",H2,2026-CSE-002'
  );

  assert.deepEqual(STUDENT_IMPORT_COLUMNS, [
    "name",
    "email",
    "roll_no",
    "hostel_code",
  ]);
  assert.deepEqual(rows, [
    {
      rowNumber: 2,
      hasExpectedColumnCount: true,
      values: {
        name: "Rao, Asha",
        email: "asha@example.edu",
        rollNo: "2026-cse-001",
        hostelCode: "h1",
      },
    },
    {
      rowNumber: 3,
      hasExpectedColumnCount: true,
      values: {
        name: 'Kabir "K" Sen',
        email: "kabir@example.edu",
        rollNo: "2026-CSE-002",
        hostelCode: "H2",
      },
    },
  ]);
});

test("CSV parser rejects incorrect headers and malformed quoted values", () => {
  assert.throws(
    () => parseStudentImportCsv("name,email,roll_no\nAsha,a@example.edu,A-1"),
    (error) => error.code === "CSV_HEADER_INVALID"
  );
  assert.throws(
    () =>
      parseStudentImportCsv(
        'name,email,roll_no,hostel_code\n"Asha,a@example.edu,A-1,H1'
      ),
    (error) => error.code === "CSV_MALFORMED"
  );
});

test("CSV parser enforces a bounded non-empty data set", () => {
  assert.throws(
    () => parseStudentImportCsv("name,email,roll_no,hostel_code\n"),
    (error) => error.code === "CSV_NO_DATA_ROWS"
  );

  const header = "name,email,roll_no,hostel_code";
  const rows = Array.from(
    { length: STUDENT_IMPORT_MAX_ROWS + 1 },
    (_, index) => `Student ${index},student${index}@example.edu,R-${index},H1`
  );

  assert.throws(
    () => parseStudentImportCsv([header, ...rows].join("\n")),
    (error) => error.code === "CSV_ROW_LIMIT_EXCEEDED"
  );
});

test("student import rejects invalid operation arguments before database access", async () => {
  const csv = "name,email,roll_no,hostel_code\nAsha Rao,asha@example.edu,A-1,H1";

  await assert.rejects(
    importStudentApprovals(null, csv, 0),
    (error) => error.code === "AUTHENTICATION_REQUIRED"
  );
  await assert.rejects(
    importStudentApprovals(null, csv, 1, { dryRun: "true" }),
    (error) => error.code === "INVALID_REQUEST"
  );
});

test("student import query validation produces an explicit boolean mode", () => {
  assert.deepEqual(
    studentApprovalImportRequestSchema.query.parse({}),
    { dryRun: true }
  );
  assert.deepEqual(
    studentApprovalImportRequestSchema.query.parse({ dryRun: "false" }),
    { dryRun: false }
  );
  assert.equal(
    studentApprovalImportRequestSchema.query.safeParse({ dryRun: "yes" }).success,
    false
  );
});
