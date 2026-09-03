import test from "node:test";
import assert from "node:assert/strict";
import { getTableConfig } from "drizzle-orm/pg-core";
import { ACCOUNT_STATUSES } from "../src/domain/accountStatuses.js";
import { USER_ROLES } from "../src/domain/roles.js";
import {
  accountStatusEnum,
  approvedStudents,
  auditEventHostels,
  auditEvents,
  hostelMemberships,
  hostels,
  staffInvitationHostels,
  staffInvitations,
  studentActivationTokens,
  userRoleEnum,
  users,
} from "../src/db/schema.js";

const findIndex = (table, name) =>
  getTableConfig(table).indexes.find((entry) => entry.config.name === name);

test("database enums constrain supported roles and account states", () => {
  assert.deepEqual(userRoleEnum.enumValues, Object.values(USER_ROLES));
  assert.deepEqual(
    accountStatusEnum.enumValues,
    Object.values(ACCOUNT_STATUSES)
  );
  assert.deepEqual(users.role.enumValues, Object.values(USER_ROLES));
  assert.deepEqual(
    users.accountStatus.enumValues,
    Object.values(ACCOUNT_STATUSES)
  );
  assert.equal(users.accountStatus.notNull, true);
  assert.equal(users.accountStatus.hasDefault, true);
  assert.equal(users.rollNo.isUnique, true);
});

test("hostels have unique human names and validated short codes", () => {
  const config = getTableConfig(hostels);

  assert.equal(hostels.code.notNull, true);
  assert.equal(hostels.code.isUnique, true);
  assert.equal(hostels.name.notNull, true);
  assert.equal(hostels.name.isUnique, true);
  assert.equal(hostels.isActive.notNull, true);
  assert.ok(
    config.checks.some((entry) => entry.name === "hostels_code_format_check")
  );
});

test("hostel memberships prevent duplicate and multiple-primary assignments", () => {
  const config = getTableConfig(hostelMemberships);
  const membershipIndex = findIndex(
    hostelMemberships,
    "hostel_memberships_user_hostel_unique"
  );
  const primaryIndex = findIndex(
    hostelMemberships,
    "hostel_memberships_one_primary_per_user"
  );

  assert.equal(config.foreignKeys.length, 2);
  assert.equal(membershipIndex.config.unique, true);
  assert.deepEqual(
    membershipIndex.config.columns.map((column) => column.name),
    ["user_id", "hostel_id"]
  );
  assert.equal(primaryIndex.config.unique, true);
  assert.ok(primaryIndex.config.where);
});

test("staff invitations store only hashed one-time tokens with constrained roles", () => {
  const config = getTableConfig(staffInvitations);
  const activeEmailIndex = findIndex(
    staffInvitations,
    "staff_invitations_active_email_unique"
  );

  assert.equal(staffInvitations.tokenHash.notNull, true);
  assert.equal(staffInvitations.tokenHash.isUnique, true);
  assert.equal(staffInvitations.tokenHash.config.length, 64);
  assert.equal(staffInvitations.expiresAt.notNull, true);
  assert.equal(config.foreignKeys.length, 1);
  assert.ok(
    config.checks.some(
      (entry) => entry.name === "staff_invitations_role_check"
    )
  );
  assert.equal(activeEmailIndex.config.unique, true);
  assert.ok(activeEmailIndex.config.where);
});

test("staff invitation hostel assignments prevent duplicates and multiple primaries", () => {
  const config = getTableConfig(staffInvitationHostels);
  const assignmentIndex = findIndex(
    staffInvitationHostels,
    "staff_invitation_hostels_invitation_hostel_unique"
  );
  const primaryIndex = findIndex(
    staffInvitationHostels,
    "staff_invitation_hostels_one_primary_per_invitation"
  );

  assert.equal(config.foreignKeys.length, 2);
  assert.equal(assignmentIndex.config.unique, true);
  assert.deepEqual(
    assignmentIndex.config.columns.map((column) => column.name),
    ["invitation_id", "hostel_id"]
  );
  assert.equal(primaryIndex.config.unique, true);
  assert.ok(primaryIndex.config.where);
});

test("approved students have unique institutional identities and one hostel", () => {
  const config = getTableConfig(approvedStudents);

  assert.equal(approvedStudents.email.isUnique, true);
  assert.equal(approvedStudents.rollNo.isUnique, true);
  assert.equal(approvedStudents.activatedUserId.isUnique, true);
  assert.equal(config.foreignKeys.length, 3);
  assert.ok(
    config.checks.some(
      (entry) => entry.name === "approved_students_email_normalized_check"
    )
  );
  assert.ok(
    config.checks.some(
      (entry) => entry.name === "approved_students_roll_no_not_blank_check"
    )
  );
});

test("student activation tokens are hashed, expiring, and single-use", () => {
  const config = getTableConfig(studentActivationTokens);
  const activeTokenIndex = findIndex(
    studentActivationTokens,
    "student_activation_tokens_one_active_per_student"
  );

  assert.equal(studentActivationTokens.tokenHash.isUnique, true);
  assert.equal(studentActivationTokens.tokenHash.config.length, 64);
  assert.equal(studentActivationTokens.expiresAt.notNull, true);
  assert.equal(config.foreignKeys.length, 1);
  assert.equal(activeTokenIndex.config.unique, true);
  assert.ok(activeTokenIndex.config.where);
});

test("audit events keep immutable actor and resource snapshots", () => {
  const config = getTableConfig(auditEvents);

  assert.equal(auditEvents.actorName.notNull, true);
  assert.equal(auditEvents.actorRole.notNull, true);
  assert.equal(auditEvents.action.notNull, true);
  assert.equal(auditEvents.resourceType.notNull, true);
  assert.equal(auditEvents.resourceId.notNull, true);
  assert.equal(auditEvents.metadata.notNull, true);
  assert.equal(auditEvents.metadata.hasDefault, true);
  assert.equal(auditEvents.createdAt.notNull, true);
  assert.equal(auditEvents.updatedAt, undefined);
  assert.equal(config.foreignKeys.length, 0);
  assert.ok(
    config.checks.some(
      (entry) => entry.name === "audit_events_metadata_object_check"
    )
  );
  assert.ok(findIndex(auditEvents, "audit_events_resource_idx"));
  assert.ok(findIndex(auditEvents, "audit_events_category_created_at_idx"));
});

test("audit hostel scopes are unique and preserve hostel snapshots", () => {
  const config = getTableConfig(auditEventHostels);
  const scopeIndex = findIndex(
    auditEventHostels,
    "audit_event_hostels_event_hostel_unique"
  );

  assert.equal(auditEventHostels.hostelCode.notNull, true);
  assert.equal(config.foreignKeys.length, 1);
  assert.equal(scopeIndex.config.unique, true);
  assert.deepEqual(
    scopeIndex.config.columns.map((column) => column.name),
    ["audit_event_id", "hostel_id"]
  );
});
