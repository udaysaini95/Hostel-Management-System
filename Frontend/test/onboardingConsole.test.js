import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import {
  APPROVAL_ACTIONS,
  APPROVAL_STATUSES,
  getApprovalActions,
  getApprovalStatusLabel,
  getApprovalStatusTone,
} from "../src/onboarding/approvedStudentView.js";
import {
  STUDENT_IMPORT_MAX_BYTES,
  validateStudentImportFile,
} from "../src/onboarding/studentImport.js";

const pagePath = fileURLToPath(
  new URL("../src/pages/ApprovedStudents.jsx", import.meta.url)
);
const stylesPath = fileURLToPath(
  new URL("../src/styles/onboarding.css", import.meta.url)
);
const importDialogPath = fileURLToPath(
  new URL("../src/onboarding/StudentImportDialog.jsx", import.meta.url)
);

test("approved-student states use plain labels and consistent tones", () => {
  assert.equal(getApprovalStatusLabel(APPROVAL_STATUSES.APPROVED), "Approved");
  assert.equal(
    getApprovalStatusLabel(APPROVAL_STATUSES.ACTIVATION_PENDING),
    "Activation sent"
  );
  assert.equal(
    getApprovalStatusLabel(APPROVAL_STATUSES.ACTIVATION_EXPIRED),
    "Expired"
  );
  assert.equal(getApprovalStatusLabel(APPROVAL_STATUSES.ACTIVATED), "Activated");
  assert.equal(getApprovalStatusLabel(APPROVAL_STATUSES.REVOKED), "Revoked");
  assert.equal(getApprovalStatusTone(APPROVAL_STATUSES.ACTIVATED), "success");
  assert.equal(getApprovalStatusTone(APPROVAL_STATUSES.REVOKED), "danger");
});

test("available actions follow the approval lifecycle", () => {
  assert.deepEqual(getApprovalActions(APPROVAL_STATUSES.APPROVED), [
    APPROVAL_ACTIONS.SEND_ACTIVATION,
    APPROVAL_ACTIONS.REVOKE,
  ]);
  assert.deepEqual(
    getApprovalActions(APPROVAL_STATUSES.ACTIVATION_PENDING),
    [APPROVAL_ACTIONS.RESEND_ACTIVATION, APPROVAL_ACTIONS.REVOKE]
  );
  assert.deepEqual(getApprovalActions(APPROVAL_STATUSES.ACTIVATED), []);
  assert.deepEqual(getApprovalActions(APPROVAL_STATUSES.REVOKED), [
    APPROVAL_ACTIONS.REINSTATE,
  ]);
});

test("the console uses server APIs and never handles activation tokens", async () => {
  const [page, importDialog] = await Promise.all([
    readFile(pagePath, "utf8"),
    readFile(importDialogPath, "utf8"),
  ]);

  assert.match(page, /api\/admin\/hostels/);
  assert.match(page, /api\/admin\/students\/approvals/);
  assert.match(page, /\/activation-email/);
  assert.match(page, /\/revoke/);
  assert.match(page, /\/reinstate/);
  assert.match(importDialog, /students\/approvals\/import/);
  assert.match(importDialog, /dryRun/);
  assert.doesNotMatch(page, /tokenHash|result\.token|response\.data\.token/);
});

test("student import applies the same file boundary shown in the interface", () => {
  assert.equal(validateStudentImportFile(null), "Choose a CSV file to review.");
  assert.equal(
    validateStudentImportFile({ name: "students.xlsx", size: 200 }),
    "Choose a file with the .csv extension."
  );
  assert.equal(
    validateStudentImportFile({
      name: "students.csv",
      size: STUDENT_IMPORT_MAX_BYTES + 1,
    }),
    "The CSV file must be 1 MB or smaller."
  );
  assert.equal(
    validateStudentImportFile({ name: "students.csv", size: 200 }),
    ""
  );
});

test("the console has a compact table and structured mobile records", async () => {
  const [page, styles, importDialog] = await Promise.all([
    readFile(pagePath, "utf8"),
    readFile(stylesPath, "utf8"),
    readFile(importDialogPath, "utf8"),
  ]);

  for (const field of ["name", "email", "rollNo", "hostelCode"]) {
    assert.match(page, new RegExp(`name="${field}"`));
  }

  assert.match(page, /<Table caption="Approved student records"/);
  assert.match(page, /hm-approvals__mobile-list/);
  assert.match(page, /<ConfirmationDialog/);
  assert.match(page, /<StudentImportDialog/);
  assert.match(importDialog, /Download CSV template/);
  assert.match(importDialog, /CSV row errors/);
  assert.match(styles, /@media\s*\(max-width:\s*767px\)/);
  assert.match(
    styles,
    /\.hm-approvals__desktop-list\s*\{[\s\S]*?display:\s*none/
  );
  assert.match(
    styles,
    /\.hm-approvals__mobile-list\s*\{[\s\S]*?display:\s*grid/
  );
});
