import test from "node:test";
import assert from "node:assert/strict";
import {
  PERMISSIONS,
  ROLE_PERMISSIONS,
  canAccessOwnedResource,
  hasPermission,
  isKnownPermission,
} from "../src/domain/permissions.js";
import { USER_ROLES } from "../src/domain/roles.js";

const roles = Object.values(USER_ROLES);

test("permission matrix covers every supported role with known unique permissions", () => {
  assert.deepEqual(Object.keys(ROLE_PERMISSIONS).sort(), [...roles].sort());

  for (const role of roles) {
    const permissions = ROLE_PERMISSIONS[role];

    assert.equal(Object.isFrozen(permissions), true);
    assert.equal(new Set(permissions).size, permissions.length);
    assert.ok(permissions.every(isKnownPermission));
  }
});

test("permission matrix enforces critical role boundaries", () => {
  const expectations = [
    [USER_ROLES.STUDENT, PERMISSIONS.LEAVE_CREATE_OWN, true],
    [USER_ROLES.ADMIN, PERMISSIONS.LEAVE_CREATE_OWN, false],
    [USER_ROLES.WARDEN, PERMISSIONS.LEAVE_REVIEW, true],
    [USER_ROLES.STUDENT, PERMISSIONS.LEAVE_REVIEW, false],
    [USER_ROLES.GUARD, PERMISSIONS.GATE_LOG_MOVEMENT, true],
    [USER_ROLES.WARDEN, PERMISSIONS.GATE_LOG_MOVEMENT, false],
    [USER_ROLES.WARDEN, PERMISSIONS.GATE_READ_ACTIVITY, true],
    [USER_ROLES.MAINTENANCE, PERMISSIONS.GATE_READ_ACTIVITY, false],
    [USER_ROLES.WARDEN, PERMISSIONS.MESS_MENU_MANAGE, true],
    [USER_ROLES.GUARD, PERMISSIONS.MESS_MENU_MANAGE, false],
    [USER_ROLES.ADMIN, PERMISSIONS.STAFF_PROVISION, true],
    [USER_ROLES.WARDEN, PERMISSIONS.STAFF_PROVISION, false],
    [USER_ROLES.ADMIN, PERMISSIONS.STUDENT_APPROVE, true],
    [USER_ROLES.WARDEN, PERMISSIONS.STUDENT_APPROVE, false],
    [USER_ROLES.ADMIN, PERMISSIONS.STUDENT_APPROVAL_MANAGE, true],
    [USER_ROLES.WARDEN, PERMISSIONS.STUDENT_APPROVAL_MANAGE, false],
    [USER_ROLES.STUDENT, PERMISSIONS.STUDENT_APPROVAL_MANAGE, false],
    [USER_ROLES.ADMIN, PERMISSIONS.AUDIT_READ, true],
    [USER_ROLES.WARDEN, PERMISSIONS.AUDIT_READ, true],
    [USER_ROLES.MAINTENANCE, PERMISSIONS.AUDIT_READ, true],
    [USER_ROLES.GUARD, PERMISSIONS.AUDIT_READ, true],
    [USER_ROLES.STUDENT, PERMISSIONS.AUDIT_READ, false],
  ];

  for (const [role, permission, expected] of expectations) {
    assert.equal(
      hasPermission(role, permission),
      expected,
      `${role} ${expected ? "should" : "should not"} have ${permission}`
    );
  }

  assert.equal(hasPermission("superadmin", PERMISSIONS.STAFF_PROVISION), false);
  assert.equal(hasPermission(USER_ROLES.ADMIN, "unknown:permission"), false);
});

test("ownership policy separates own-record and global access", () => {
  const student = { id: 7, role: USER_ROLES.STUDENT };
  const warden = { id: 8, role: USER_ROLES.WARDEN };
  const admin = { id: 9, role: USER_ROLES.ADMIN };

  assert.equal(
    canAccessOwnedResource({
      actor: student,
      ownerId: "7",
      ownPermission: PERMISSIONS.COMPLAINT_DELETE_OWN,
      anyPermission: PERMISSIONS.COMPLAINT_DELETE_ANY,
    }),
    true
  );
  assert.equal(
    canAccessOwnedResource({
      actor: student,
      ownerId: 8,
      ownPermission: PERMISSIONS.COMPLAINT_DELETE_OWN,
      anyPermission: PERMISSIONS.COMPLAINT_DELETE_ANY,
    }),
    false
  );
  assert.equal(
    canAccessOwnedResource({
      actor: admin,
      ownerId: 7,
      ownPermission: PERMISSIONS.COMPLAINT_DELETE_OWN,
      anyPermission: PERMISSIONS.COMPLAINT_DELETE_ANY,
    }),
    true
  );
  assert.equal(
    canAccessOwnedResource({
      actor: warden,
      ownerId: 7,
      ownPermission: PERMISSIONS.COMPLAINT_DELETE_OWN,
      anyPermission: PERMISSIONS.COMPLAINT_DELETE_ANY,
    }),
    false
  );
  assert.equal(
    canAccessOwnedResource({
      actor: warden,
      ownerId: 7,
      ownPermission: PERMISSIONS.COMPLAINT_VERIFY_OWN,
      anyPermission: PERMISSIONS.COMPLAINT_VERIFY_ANY,
    }),
    true
  );
});

test("ownership policy denies missing and injected actor identities", () => {
  const request = {
    ownerId: 7,
    ownPermission: PERMISSIONS.COMPLAINT_DELETE_OWN,
    anyPermission: PERMISSIONS.COMPLAINT_DELETE_ANY,
  };

  assert.equal(canAccessOwnedResource({ ...request, actor: null }), false);
  assert.equal(
    canAccessOwnedResource({
      ...request,
      actor: { role: USER_ROLES.ADMIN },
    }),
    false
  );
  assert.equal(
    canAccessOwnedResource({
      ...request,
      actor: { id: 7, role: "superadmin" },
    }),
    false
  );
});
