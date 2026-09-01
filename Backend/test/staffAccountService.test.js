import test from "node:test";
import assert from "node:assert/strict";
import { ACCOUNT_STATUSES } from "../src/domain/accountStatuses.js";
import { USER_ROLES } from "../src/domain/roles.js";
import {
  createInvitationToken,
  hashInvitationToken,
  INVITABLE_STAFF_ROLES,
  normalizeStaffInvitationInput,
  STAFF_INVITATION_TOKEN_BYTES,
  STAFF_PASSWORD_MAX_BYTES,
  validateManagedAccountStatus,
  validateStaffPassword,
} from "../src/services/staffAccountService.js";

test("staff invitation tokens are random, URL-safe, and stored as fixed hashes", () => {
  const firstToken = createInvitationToken();
  const secondToken = createInvitationToken();
  const firstHash = hashInvitationToken(firstToken);

  assert.notEqual(firstToken, secondToken);
  assert.match(firstToken, /^[A-Za-z0-9_-]+$/);
  assert.equal(Buffer.from(firstToken, "base64url").length, STAFF_INVITATION_TOKEN_BYTES);
  assert.match(firstHash, /^[a-f0-9]{64}$/);
  assert.equal(hashInvitationToken(firstToken), firstHash);
  assert.notEqual(firstHash, firstToken);
});

test("staff invitations normalize identities and multi-hostel assignments", () => {
  const values = normalizeStaffInvitationInput({
    name: "  Grace Hopper  ",
    email: "  WARDEN@EXAMPLE.COM ",
    role: USER_ROLES.WARDEN,
    hostelCodes: ["h2", " H1 ", "h2"],
    primaryHostelCode: "h1",
  });

  assert.deepEqual(values, {
    name: "Grace Hopper",
    email: "warden@example.com",
    role: USER_ROLES.WARDEN,
    hostelCodes: ["H2", "H1"],
    primaryHostelCode: "H1",
  });
  assert.equal(Object.isFrozen(values), true);
  assert.equal(Object.isFrozen(values.hostelCodes), true);
});

test("only operational staff roles can be invited", () => {
  assert.deepEqual(INVITABLE_STAFF_ROLES, [
    USER_ROLES.WARDEN,
    USER_ROLES.MAINTENANCE,
    USER_ROLES.GUARD,
  ]);

  for (const role of [USER_ROLES.STUDENT, USER_ROLES.ADMIN, "superadmin"]) {
    assert.throws(
      () =>
        normalizeStaffInvitationInput({
          name: "Invalid Invite",
          email: "person@example.com",
          role,
          hostelCodes: ["H1"],
        }),
      (error) => error.code === "INVALID_STAFF_ROLE"
    );
  }
});

test("invitation validation requires known-format hostel assignments", () => {
  const baseInput = {
    name: "Hostel Warden",
    email: "warden@example.com",
    role: USER_ROLES.WARDEN,
  };

  assert.throws(
    () => normalizeStaffInvitationInput(baseInput),
    (error) => error.code === "INVALID_HOSTELS"
  );
  assert.throws(
    () =>
      normalizeStaffInvitationInput({
        ...baseInput,
        hostelCodes: ["H1"],
        primaryHostelCode: "H2",
      }),
    (error) => error.code === "INVALID_PRIMARY_HOSTEL"
  );
});

test("staff passwords respect bcrypt's secure input boundary", () => {
  assert.equal(validateStaffPassword("correct horse battery staple"), "correct horse battery staple");
  assert.throws(
    () => validateStaffPassword("short"),
    (error) => error.code === "WEAK_PASSWORD"
  );
  assert.throws(
    () => validateStaffPassword("x".repeat(STAFF_PASSWORD_MAX_BYTES + 1)),
    (error) => error.code === "WEAK_PASSWORD"
  );
});

test("account management allows only active and suspended states", () => {
  assert.equal(
    validateManagedAccountStatus(ACCOUNT_STATUSES.ACTIVE),
    ACCOUNT_STATUSES.ACTIVE
  );
  assert.equal(
    validateManagedAccountStatus(ACCOUNT_STATUSES.SUSPENDED),
    ACCOUNT_STATUSES.SUSPENDED
  );
  assert.throws(
    () => validateManagedAccountStatus(ACCOUNT_STATUSES.PENDING),
    (error) => error.code === "INVALID_ACCOUNT_STATUS"
  );
});
