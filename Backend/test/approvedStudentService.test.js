import test from "node:test";
import assert from "node:assert/strict";
import { APPROVED_STUDENT_STATUSES } from "../src/domain/approvedStudentStatuses.js";
import {
  getApprovedStudentLifecycleStatus,
  normalizeApprovedStudentFilters,
  normalizeApprovalReinstatementInput,
  normalizeApprovalRevocationInput,
} from "../src/services/approvedStudentService.js";

test("approved-student filters normalize search, hostel, and pagination", () => {
  assert.deepEqual(
    normalizeApprovedStudentFilters({
      page: "2",
      pageSize: "25",
      search: "  asha  ",
      hostelCode: " h2 ",
      status: APPROVED_STUDENT_STATUSES.ACTIVATION_PENDING,
    }),
    {
      page: 2,
      pageSize: 25,
      search: "asha",
      hostelCode: "H2",
      status: APPROVED_STUDENT_STATUSES.ACTIVATION_PENDING,
    }
  );
});

test("approved-student filters reject unsafe pagination and unknown states", () => {
  assert.throws(
    () => normalizeApprovedStudentFilters({ pageSize: 101 }),
    (error) => error.code === "INVALID_PAGE_SIZE"
  );
  assert.throws(
    () => normalizeApprovedStudentFilters({ status: "invited" }),
    (error) => error.code === "INVALID_APPROVAL_STATUS"
  );
});

test("approval lifecycle state prioritizes revocation and activation", () => {
  const now = new Date("2026-09-05T12:00:00.000Z");

  assert.equal(
    getApprovedStudentLifecycleStatus({}, now),
    APPROVED_STUDENT_STATUSES.APPROVED
  );
  assert.equal(
    getApprovedStudentLifecycleStatus(
      { activationExpiresAt: new Date("2026-09-05T12:30:00.000Z") },
      now
    ),
    APPROVED_STUDENT_STATUSES.ACTIVATION_PENDING
  );
  assert.equal(
    getApprovedStudentLifecycleStatus(
      { activationExpiresAt: new Date("2026-09-05T11:59:59.000Z") },
      now
    ),
    APPROVED_STUDENT_STATUSES.ACTIVATION_EXPIRED
  );
  assert.equal(
    getApprovedStudentLifecycleStatus(
      {
        activatedAt: new Date("2026-09-05T11:00:00.000Z"),
        activationExpiresAt: new Date("2026-09-05T12:30:00.000Z"),
      },
      now
    ),
    APPROVED_STUDENT_STATUSES.ACTIVATED
  );
  assert.equal(
    getApprovedStudentLifecycleStatus(
      {
        activatedAt: new Date("2026-09-05T11:00:00.000Z"),
        revokedAt: new Date("2026-09-05T11:30:00.000Z"),
      },
      now
    ),
    APPROVED_STUDENT_STATUSES.REVOKED
  );
});

test("approval revocation requires an auditable reason", () => {
  assert.deepEqual(
    normalizeApprovalRevocationInput({ reason: "  Student record withdrawn  " }),
    { reason: "Student record withdrawn" }
  );
  assert.throws(
    () => normalizeApprovalRevocationInput({ reason: "no" }),
    (error) => error.code === "INVALID_REVOCATION_REASON"
  );
});

test("approval reinstatement keeps its reason separate from revocation", () => {
  assert.deepEqual(
    normalizeApprovalReinstatementInput({ reason: "  Admission restored  " }),
    { reason: "Admission restored" }
  );
  assert.throws(
    () => normalizeApprovalReinstatementInput({ reason: "no" }),
    (error) => error.code === "INVALID_REINSTATEMENT_REASON"
  );
});
