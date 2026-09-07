import test from "node:test";
import assert from "node:assert/strict";
import {
  assignComplaint,
  normalizeAssigneeFilters,
  normalizeComplaintAssignmentInput,
} from "../src/services/complaintAssignmentService.js";

test("assignment input normalizes the assignee and optional reason", () => {
  assert.deepEqual(
    normalizeComplaintAssignmentInput({
      assigneeUserId: "12",
      reason: "  Technician is covering the evening shift.  ",
    }),
    {
      assigneeUserId: 12,
      reason: "Technician is covering the evening shift.",
    }
  );
  assert.deepEqual(
    normalizeComplaintAssignmentInput({ assigneeUserId: 12 }),
    { assigneeUserId: 12, reason: null }
  );
});

test("assignee lookup requires a normalized hostel code", () => {
  assert.deepEqual(normalizeAssigneeFilters({ hostelCode: " h2 " }), {
    hostelCode: "H2",
  });
  assert.throws(
    () => normalizeAssigneeFilters({ hostelCode: "../H2" }),
    (error) => error.code === "INVALID_HOSTEL"
  );
});

test("assignment validation rejects unsafe input before database access", async () => {
  assert.throws(
    () => normalizeComplaintAssignmentInput({ assigneeUserId: 0 }),
    (error) => error.code === "INVALID_REQUEST"
  );
  assert.throws(
    () =>
      normalizeComplaintAssignmentInput({
        assigneeUserId: 2,
        reason: "x".repeat(501),
      }),
    (error) => error.code === "INVALID_ASSIGNMENT_REASON"
  );
  assert.throws(
    () =>
      normalizeComplaintAssignmentInput({
        assigneeUserId: 2,
        reason: "no",
      }),
    (error) => error.code === "INVALID_ASSIGNMENT_REASON"
  );
  await assert.rejects(
    assignComplaint(null, null, 1, { assigneeUserId: 2 }),
    (error) => error.code === "AUTHENTICATION_REQUIRED"
  );
});
