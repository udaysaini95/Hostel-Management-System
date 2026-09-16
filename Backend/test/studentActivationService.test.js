import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeStudentActivationRequest,
  normalizeStudentApprovalInput,
  STUDENT_ACTIVATION_TTL_MS,
} from "../src/services/studentActivationService.js";

test("student approval normalizes institutional identity and hostel code", () => {
  const approval = normalizeStudentApprovalInput({
    name: "  Asha Rao  ",
    email: "  ASHA.RAO@COLLEGE.EDU ",
    rollNo: "  2026 cse 042  ",
    housingType: " GIRLS ",
    hostelCode: " h2 ",
  });

  assert.deepEqual(approval, {
    name: "Asha Rao",
    email: "asha.rao@college.edu",
    rollNo: "2026 CSE 042",
    housingType: "girls",
    hostelCode: "H2",
  });
});

test("activation requests use the same normalized email and roll number", () => {
  assert.deepEqual(
    normalizeStudentActivationRequest({
      email: " ASHA.RAO@COLLEGE.EDU ",
      rollNo: "2026   cse 042",
    }),
    {
      email: "asha.rao@college.edu",
      rollNo: "2026 CSE 042",
    }
  );
});

test("student identity validation rejects incomplete and malformed records", () => {
  assert.throws(
    () =>
      normalizeStudentApprovalInput({
        name: "Asha Rao",
        email: "not-an-email",
        rollNo: "2026-CSE-042",
        housingType: "girls",
        hostelCode: "H1",
      }),
    (error) => error.code === "INVALID_EMAIL"
  );

  assert.throws(
    () =>
      normalizeStudentApprovalInput({
        name: "Asha Rao",
        email: "asha@college.edu",
        rollNo: "?",
        housingType: "girls",
        hostelCode: "H1",
      }),
    (error) => error.code === "INVALID_ROLL_NO"
  );

  assert.throws(
    () =>
      normalizeStudentApprovalInput({
        name: "Asha Rao",
        email: "asha@college.edu",
        rollNo: "2026-CSE-042",
        housingType: "girls",
        hostelCode: "hostel one",
      }),
    (error) => error.code === "INVALID_HOSTEL"
  );

  assert.throws(
    () =>
      normalizeStudentApprovalInput({
        name: "Asha Rao",
        email: "asha@college.edu",
        rollNo: "2026-CSE-042",
        housingType: "co_ed",
        hostelCode: "H1",
      }),
    (error) => error.code === "INVALID_HOUSING_TYPE"
  );
});

test("student activation links expire after thirty minutes", () => {
  assert.equal(STUDENT_ACTIVATION_TTL_MS, 30 * 60 * 1000);
});
