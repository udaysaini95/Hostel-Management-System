import test from "node:test";
import assert from "node:assert/strict";
import { getTableConfig } from "drizzle-orm/pg-core";
import { ACCOUNT_STATUSES } from "../src/domain/accountStatuses.js";
import {
  COMPLAINT_ATTACHMENT_PURPOSES,
  COMPLAINT_EVENT_TYPES,
  COMPLAINT_PRIORITIES,
  COMPLAINT_STATUSES,
} from "../src/domain/complaintWorkflow.js";
import { USER_ROLES } from "../src/domain/roles.js";
import { MEAL_TYPE_ORDER } from "../src/domain/mess.js";
import {
  GATE_MOVEMENTS,
  GATE_VERIFICATION_METHODS,
  LEAVE_DECISION_OUTCOMES,
  LEAVE_EVENT_TYPES,
  LEAVE_STATUSES,
} from "../src/domain/leaveWorkflow.js";
import {
  accountStatusEnum,
  approvedStudents,
  auditEventHostels,
  auditEvents,
  complaintAssignments,
  complaintAttachmentPurposeEnum,
  complaintAttachments,
  complaintCategories,
  complaintEventTypeEnum,
  complaintEvents,
  complaintPriorityEnum,
  complaints,
  complaintStatusEnum,
  gateEvents,
  gateMovementEnum,
  gatePasses,
  gateVerificationMethodEnum,
  hostelBlocks,
  hostelMemberships,
  hostels,
  leaveDecisionOutcomeEnum,
  leaveDecisions,
  leaveEventTypeEnum,
  leaveEvents,
  leaveRequests,
  leaveStatusEnum,
  messMealTypeEnum,
  messFeedbacks,
  messIssueAttachments,
  messIssueEvents,
  messIssues,
  messIssueStatusEnum,
  messIssueTypeEnum,
  messMenuItems,
  messMenus,
  messMenuVersions,
  noticeAudienceTypeEnum,
  noticePriorityEnum,
  noticeRecipients,
  notices,
  legacyGateLogs,
  legacyLeaves,
  roomAllocations,
  rooms,
  staffInvitationHostels,
  staffInvitations,
  staffProfiles,
  studentActivationTokens,
  studentProfiles,
  userRoleEnum,
  users,
} from "../src/db/schema.js";
import {
  NOTICE_AUDIENCE_TYPES,
  NOTICE_PRIORITIES,
} from "../src/domain/notices.js";

const findIndex = (table, name) =>
  getTableConfig(table).indexes.find((entry) => entry.config.name === name);

test("mess menus use hostel-scoped dates and normalized versioned items", () => {
  assert.deepEqual(messMealTypeEnum.enumValues, MEAL_TYPE_ORDER);
  assert.equal(messMenus.hostelId.notNull, true);
  assert.equal(messMenus.menuDate.notNull, true);
  assert.equal(messMenus.currentVersion.notNull, true);
  assert.ok(findIndex(messMenus, "mess_menus_hostel_date_unique"));
  assert.equal(messMenuVersions.menuId.notNull, true);
  assert.equal(messMenuVersions.publishedByUserId.notNull, true);
  assert.ok(
    findIndex(messMenuVersions, "mess_menu_versions_menu_version_unique")
  );
  assert.equal(messMenuItems.menuVersionId.notNull, true);
  assert.equal(messMenuItems.mealType.notNull, true);
  assert.ok(findIndex(messMenuItems, "mess_menu_items_position_unique"));
});

test("mess feedback stores one validated rating per student menu meal", () => {
  const config = getTableConfig(messFeedbacks);
  const uniqueRating = findIndex(
    messFeedbacks,
    "mess_feedbacks_student_menu_meal_unique"
  );

  assert.equal(messFeedbacks.menuId.notNull, true);
  assert.equal(messFeedbacks.menuVersionId.notNull, true);
  assert.equal(messFeedbacks.studentUserId.notNull, true);
  assert.equal(messFeedbacks.rating.notNull, true);
  assert.equal(config.foreignKeys.length, 3);
  assert.ok(config.checks.some((entry) => entry.name === "mess_feedbacks_rating_check"));
  assert.deepEqual(
    uniqueRating.config.columns.map((column) => column.name),
    ["student_user_id", "menu_id", "meal_type"]
  );
});

test("mess issues keep hostel scope, workflow history, and private evidence metadata", () => {
  const issueConfig = getTableConfig(messIssues);
  const eventConfig = getTableConfig(messIssueEvents);
  const attachmentConfig = getTableConfig(messIssueAttachments);

  assert.deepEqual(messIssueStatusEnum.enumValues, ["reported", "in_progress", "resolved"]);
  assert.deepEqual(messIssueTypeEnum.enumValues, [
    "food_quality",
    "hygiene",
    "quantity",
    "staff_behavior",
    "other",
  ]);
  assert.equal(messIssues.hostelId.notNull, true);
  assert.equal(messIssues.reportedByUserId.notNull, true);
  assert.equal(messIssues.description.notNull, true);
  assert.ok(issueConfig.checks.some((entry) => entry.name === "mess_issues_description_check"));
  assert.equal(eventConfig.foreignKeys.length, 2);
  assert.equal(messIssueEvents.actorName.notNull, true);
  assert.equal(attachmentConfig.foreignKeys.length, 2);
  assert.equal(messIssueAttachments.storageKey.isUnique, true);
  assert.equal(messIssueAttachments.sha256.notNull, true);
});

test("notices keep an explicit audience and one read state per recipient", () => {
  const noticeConfig = getTableConfig(notices);
  const recipientConfig = getTableConfig(noticeRecipients);

  assert.deepEqual(noticePriorityEnum.enumValues, Object.values(NOTICE_PRIORITIES));
  assert.deepEqual(noticeAudienceTypeEnum.enumValues, Object.values(NOTICE_AUDIENCE_TYPES));
  assert.equal(notices.publishedByUserId.notNull, true);
  assert.ok(noticeConfig.checks.some((entry) => entry.name === "notices_audience_shape_check"));
  assert.equal(recipientConfig.foreignKeys.length, 2);
  assert.ok(findIndex(noticeRecipients, "notice_recipients_notice_user_unique")?.config.unique);
  assert.equal(noticeRecipients.readAt.notNull, false);
});

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

test("complaint enums match the workflow domain values", () => {
  assert.deepEqual(
    complaintStatusEnum.enumValues,
    Object.values(COMPLAINT_STATUSES)
  );
  assert.deepEqual(
    complaintPriorityEnum.enumValues,
    Object.values(COMPLAINT_PRIORITIES)
  );
  assert.deepEqual(
    complaintEventTypeEnum.enumValues,
    Object.values(COMPLAINT_EVENT_TYPES)
  );
  assert.deepEqual(
    complaintAttachmentPurposeEnum.enumValues,
    Object.values(COMPLAINT_ATTACHMENT_PURPOSES)
  );
});

test("leave and gate enums match the workflow domain values", () => {
  assert.deepEqual(leaveStatusEnum.enumValues, Object.values(LEAVE_STATUSES));
  assert.deepEqual(
    leaveDecisionOutcomeEnum.enumValues,
    Object.values(LEAVE_DECISION_OUTCOMES)
  );
  assert.deepEqual(
    leaveEventTypeEnum.enumValues,
    Object.values(LEAVE_EVENT_TYPES)
  );
  assert.deepEqual(gateMovementEnum.enumValues, Object.values(GATE_MOVEMENTS));
  assert.deepEqual(
    gateVerificationMethodEnum.enumValues,
    Object.values(GATE_VERIFICATION_METHODS)
  );
});

test("normalized leave records keep student, hostel, schedule, and emergency context", () => {
  const config = getTableConfig(leaveRequests);

  assert.equal(config.foreignKeys.length, 4);
  assert.equal(leaveRequests.hostelId.notNull, true);
  assert.equal(leaveRequests.studentUserId.notNull, true);
  assert.equal(leaveRequests.studentProfileId.notNull, true);
  assert.equal(leaveRequests.departureAt.notNull, true);
  assert.equal(leaveRequests.expectedReturnAt.notNull, true);
  assert.equal(leaveRequests.isEmergency.hasDefault, true);
  assert.equal(leaveRequests.status.hasDefault, true);
  assert.ok(findIndex(leaveRequests, "leave_requests_student_status_idx"));
  assert.ok(findIndex(leaveRequests, "leave_requests_outside_return_idx").config.where);
  assert.ok(
    config.checks.some(
      (entry) => entry.name === "leave_requests_date_order_check"
    )
  );
});

test("leave decisions and timeline rows are append-only shaped records", () => {
  const decisionConfig = getTableConfig(leaveDecisions);
  const eventConfig = getTableConfig(leaveEvents);

  assert.equal(leaveDecisions.leaveRequestId.isUnique, true);
  assert.equal(decisionConfig.foreignKeys.length, 2);
  assert.equal(leaveDecisions.note.notNull, true);
  assert.equal(leaveEvents.actorName.notNull, true);
  assert.equal(leaveEvents.actorRole.notNull, true);
  assert.equal(leaveEvents.metadata.notNull, true);
  assert.equal(leaveEvents.updatedAt, undefined);
  assert.ok(findIndex(leaveEvents, "leave_events_timeline_idx"));
  assert.ok(
    eventConfig.checks.some(
      (entry) => entry.name === "leave_events_metadata_object_check"
    )
  );
});

test("gate passes store hashed tokens and gate events enforce idempotent movement", () => {
  const passConfig = getTableConfig(gatePasses);
  const eventConfig = getTableConfig(gateEvents);
  const movementIndex = findIndex(
    gateEvents,
    "gate_events_one_movement_per_leave"
  );

  assert.equal(gatePasses.leaveRequestId.isUnique, true);
  assert.equal(gatePasses.tokenHash.isUnique, true);
  assert.equal(gatePasses.tokenHash.config.length, 64);
  assert.equal(gatePasses.qrStorageKey.isUnique, true);
  assert.equal(gatePasses.pdfStorageKey.isUnique, true);
  assert.equal(passConfig.foreignKeys.length, 3);
  assert.equal(gateEvents.idempotencyKey.isUnique, true);
  assert.equal(eventConfig.foreignKeys.length, 3);
  assert.equal(movementIndex.config.unique, true);
  assert.ok(
    eventConfig.checks.some(
      (entry) => entry.name === "gate_events_pass_required_check"
    )
  );
});

test("legacy leave tables remain explicit compatibility models", () => {
  assert.equal(getTableConfig(legacyLeaves).name, "legacy_leaves");
  assert.equal(getTableConfig(legacyGateLogs).name, "legacy_gate_logs");
});

test("complaints keep explicit hostel, reporter, category, room, and SLA context", () => {
  const config = getTableConfig(complaints);

  assert.equal(config.foreignKeys.length, 5);
  assert.equal(complaints.hostelId.notNull, true);
  assert.equal(complaints.reportedByUserId.notNull, true);
  assert.equal(complaints.categoryId.notNull, true);
  assert.equal(complaints.priority.notNull, true);
  assert.equal(complaints.slaPolicyMinutes.notNull, true);
  assert.equal(complaints.slaDeadline.notNull, true);
  assert.equal(complaints.slaBreachedAt.notNull, false);
  assert.equal(complaints.status.hasDefault, true);
  assert.ok(findIndex(complaints, "complaints_hostel_status_created_idx"));
  assert.ok(findIndex(complaints, "complaints_open_sla_idx").config.where);
  assert.ok(
    findIndex(complaints, "complaints_pending_sla_breach_idx").config.where
  );
  assert.ok(
    config.checks.some(
      (entry) => entry.name === "complaints_resolution_details_check"
    )
  );
  assert.ok(
    config.checks.some(
      (entry) => entry.name === "complaints_sla_breached_at_check"
    )
  );
});

test("complaint categories own the default priority and SLA policy", () => {
  const config = getTableConfig(complaintCategories);

  assert.equal(complaintCategories.code.isUnique, true);
  assert.equal(complaintCategories.name.isUnique, true);
  assert.equal(complaintCategories.defaultPriority.notNull, true);
  assert.equal(complaintCategories.slaMinutes.notNull, true);
  assert.ok(
    config.checks.some(
      (entry) => entry.name === "complaint_categories_sla_bounds_check"
    )
  );
});

test("complaint assignments preserve hand-offs and allow one active assignee", () => {
  const config = getTableConfig(complaintAssignments);
  const activeAssignment = findIndex(
    complaintAssignments,
    "complaint_assignments_one_active_per_complaint"
  );

  assert.equal(config.foreignKeys.length, 4);
  assert.equal(activeAssignment.config.unique, true);
  assert.ok(activeAssignment.config.where);
  assert.ok(
    config.checks.some(
      (entry) => entry.name === "complaint_assignments_end_details_check"
    )
  );
});

test("complaint events store actor snapshots and have no update timestamp", () => {
  const config = getTableConfig(complaintEvents);

  assert.equal(complaintEvents.actorName.notNull, true);
  assert.equal(complaintEvents.actorRole.notNull, true);
  assert.equal(complaintEvents.metadata.notNull, true);
  assert.equal(complaintEvents.updatedAt, undefined);
  assert.ok(findIndex(complaintEvents, "complaint_events_timeline_idx"));
  assert.ok(
    config.checks.some(
      (entry) => entry.name === "complaint_events_metadata_object_check"
    )
  );
});

test("complaint attachments store private file metadata instead of public URLs", () => {
  const config = getTableConfig(complaintAttachments);

  assert.equal(complaintAttachments.storageKey.notNull, true);
  assert.equal(complaintAttachments.storageKey.isUnique, true);
  assert.equal(complaintAttachments.publicUrl, undefined);
  assert.equal(complaintAttachments.url, undefined);
  assert.equal(config.foreignKeys.length, 3);
  assert.ok(
    config.checks.some(
      (entry) => entry.name === "complaint_attachments_mime_type_check"
    )
  );
  assert.ok(
    config.checks.some(
      (entry) => entry.name === "complaint_attachments_size_check"
    )
  );
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

test("resident profiles keep institutional identity separate from login accounts", () => {
  const config = getTableConfig(studentProfiles);

  assert.equal(studentProfiles.userId.notNull, true);
  assert.equal(studentProfiles.userId.isUnique, true);
  assert.equal(studentProfiles.hostelId.notNull, true);
  assert.equal(studentProfiles.rollNo.notNull, true);
  assert.equal(studentProfiles.rollNo.isUnique, true);
  assert.equal(config.foreignKeys.length, 3);
  assert.ok(
    config.foreignKeys.some(
      (entry) => entry.reference().name === "student_profiles_membership_fk"
    )
  );
  assert.ok(
    config.checks.some(
      (entry) => entry.name === "student_profiles_roll_no_format_check"
    )
  );
});

test("staff profiles support one optional institutional record per account", () => {
  const config = getTableConfig(staffProfiles);

  assert.equal(staffProfiles.userId.notNull, true);
  assert.equal(staffProfiles.userId.isUnique, true);
  assert.equal(staffProfiles.employeeNo.isUnique, true);
  assert.equal(config.foreignKeys.length, 1);
  assert.ok(
    config.checks.some(
      (entry) => entry.name === "staff_profiles_employee_no_not_blank_check"
    )
  );
});

test("hostel blocks and rooms have scoped identities and bounded capacity", () => {
  const blockConfig = getTableConfig(hostelBlocks);
  const roomConfig = getTableConfig(rooms);
  const blockIdentity = findIndex(
    hostelBlocks,
    "hostel_blocks_hostel_code_unique"
  );
  const roomIdentity = findIndex(rooms, "rooms_block_number_unique");

  assert.equal(blockConfig.foreignKeys.length, 1);
  assert.equal(blockIdentity.config.unique, true);
  assert.deepEqual(
    blockIdentity.config.columns.map((column) => column.name),
    ["hostel_id", "code"]
  );
  assert.equal(roomConfig.foreignKeys.length, 1);
  assert.equal(roomIdentity.config.unique, true);
  assert.deepEqual(
    roomIdentity.config.columns.map((column) => column.name),
    ["block_id", "room_number"]
  );
  assert.ok(
    roomConfig.checks.some(
      (entry) => entry.name === "rooms_capacity_bounds_check"
    )
  );
});

test("room allocations preserve history and allow one current room per student", () => {
  const config = getTableConfig(roomAllocations);
  const currentAllocation = findIndex(
    roomAllocations,
    "room_allocations_one_active_per_student"
  );
  const historyIndex = findIndex(
    roomAllocations,
    "room_allocations_student_history_idx"
  );

  assert.equal(config.foreignKeys.length, 4);
  assert.equal(currentAllocation.config.unique, true);
  assert.ok(currentAllocation.config.where);
  assert.deepEqual(
    historyIndex.config.columns.map((column) => column.name),
    ["student_profile_id", "allocated_at"]
  );
  assert.ok(
    config.checks.some(
      (entry) => entry.name === "room_allocations_dates_check"
    )
  );
  assert.ok(
    config.checks.some(
      (entry) => entry.name === "room_allocations_vacancy_details_check"
    )
  );
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
