import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { ACCOUNT_STATUSES } from "../domain/accountStatuses.js";
import {
  COMPLAINT_ATTACHMENT_PURPOSES,
  COMPLAINT_EVENT_TYPES,
  COMPLAINT_PRIORITIES,
  COMPLAINT_STATUSES,
} from "../domain/complaintWorkflow.js";
import { USER_ROLES } from "../domain/roles.js";
import {
  GATE_MOVEMENTS,
  GATE_VERIFICATION_METHODS,
  LEAVE_DECISION_OUTCOMES,
  LEAVE_EVENT_TYPES,
  LEAVE_STATUSES,
} from "../domain/leaveWorkflow.js";

export const userRoleEnum = pgEnum("user_role", Object.values(USER_ROLES));
export const accountStatusEnum = pgEnum(
  "account_status",
  Object.values(ACCOUNT_STATUSES)
);
export const complaintStatusEnum = pgEnum(
  "complaint_status",
  Object.values(COMPLAINT_STATUSES)
);
export const complaintPriorityEnum = pgEnum(
  "complaint_priority",
  Object.values(COMPLAINT_PRIORITIES)
);
export const complaintEventTypeEnum = pgEnum(
  "complaint_event_type",
  Object.values(COMPLAINT_EVENT_TYPES)
);
export const complaintAttachmentPurposeEnum = pgEnum(
  "complaint_attachment_purpose",
  Object.values(COMPLAINT_ATTACHMENT_PURPOSES)
);
export const leaveStatusEnum = pgEnum(
  "leave_status",
  Object.values(LEAVE_STATUSES)
);
export const leaveDecisionOutcomeEnum = pgEnum(
  "leave_decision_outcome",
  Object.values(LEAVE_DECISION_OUTCOMES)
);
export const leaveEventTypeEnum = pgEnum(
  "leave_event_type",
  Object.values(LEAVE_EVENT_TYPES)
);
export const gateMovementEnum = pgEnum(
  "gate_movement",
  Object.values(GATE_MOVEMENTS)
);
export const gateVerificationMethodEnum = pgEnum(
  "gate_verification_method",
  Object.values(GATE_VERIFICATION_METHODS)
);

// A single institution can manage multiple hostel buildings (for example H1 and H2).
export const hostels = pgTable(
  "hostels",
  {
    id: serial("id").primaryKey(),
    code: varchar("code", { length: 20 }).notNull().unique(),
    name: varchar("name", { length: 255 }).notNull().unique(),
    address: text("address"),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    check(
      "hostels_code_format_check",
      sql`${table.code} ~ '^[A-Z][A-Z0-9-]{0,19}$'`
    ),
  ]
);

// 1. Users Table
export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    email: varchar("email", { length: 255 }).notNull().unique(),
    password: varchar("password", { length: 255 }).notNull(),
    role: userRoleEnum("role").default(USER_ROLES.STUDENT).notNull(),
    accountStatus: accountStatusEnum("account_status")
      .default(ACCOUNT_STATUSES.ACTIVE)
      .notNull(),
    emailVerifiedAt: timestamp("email_verified_at"),
    lastLoginAt: timestamp("last_login_at"),
    // Temporary compatibility fields for legacy complaint, leave, and gate
    // queries. New resident work must use student_profiles/room_allocations.
    rollNo: varchar("roll_no", { length: 50 }).unique(),
    phone: varchar("phone", { length: 50 }),
    roomNo: varchar("room_no", { length: 50 }),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [index("users_account_status_idx").on(table.accountStatus)]
);

// Memberships scope residents and staff to hostel buildings without coupling access to email.
export const hostelMemberships = pgTable(
  "hostel_memberships",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    hostelId: integer("hostel_id")
      .notNull()
      .references(() => hostels.id, { onDelete: "restrict" }),
    isPrimary: boolean("is_primary").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("hostel_memberships_user_hostel_unique").on(
      table.userId,
      table.hostelId
    ),
    uniqueIndex("hostel_memberships_one_primary_per_user")
      .on(table.userId)
      .where(sql`${table.isPrimary} = true`),
    index("hostel_memberships_hostel_id_idx").on(table.hostelId),
  ]
);

// Student-specific details live outside the account record. The hostel is kept
// on the profile because a resident has one home hostel, while staff can belong
// to several hostels through hostel_memberships.
export const studentProfiles = pgTable(
  "student_profiles",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .unique()
      .references(() => users.id, { onDelete: "restrict" }),
    hostelId: integer("hostel_id")
      .notNull()
      .references(() => hostels.id, { onDelete: "restrict" }),
    rollNo: varchar("roll_no", { length: 50 }).notNull().unique(),
    phone: varchar("phone", { length: 20 }),
    guardianName: varchar("guardian_name", { length: 255 }),
    guardianPhone: varchar("guardian_phone", { length: 20 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check(
      "student_profiles_roll_no_format_check",
      sql`${table.rollNo} ~ '^[A-Z0-9][A-Z0-9 /-]{1,49}$'`
    ),
    check(
      "student_profiles_phone_format_check",
      sql`${table.phone} is null or ${table.phone} ~ '^[0-9+() -]{7,20}$'`
    ),
    check(
      "student_profiles_guardian_name_not_blank_check",
      sql`${table.guardianName} is null or length(trim(${table.guardianName})) > 0`
    ),
    check(
      "student_profiles_guardian_phone_format_check",
      sql`${table.guardianPhone} is null or ${table.guardianPhone} ~ '^[0-9+() -]{7,20}$'`
    ),
    foreignKey({
      name: "student_profiles_membership_fk",
      columns: [table.userId, table.hostelId],
      foreignColumns: [hostelMemberships.userId, hostelMemberships.hostelId],
    }).onDelete("restrict"),
    index("student_profiles_hostel_id_idx").on(table.hostelId),
  ]
);

export const staffProfiles = pgTable(
  "staff_profiles",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .unique()
      .references(() => users.id, { onDelete: "restrict" }),
    employeeNo: varchar("employee_no", { length: 50 }).unique(),
    phone: varchar("phone", { length: 20 }),
    jobTitle: varchar("job_title", { length: 100 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check(
      "staff_profiles_employee_no_not_blank_check",
      sql`${table.employeeNo} is null or length(trim(${table.employeeNo})) > 0`
    ),
    check(
      "staff_profiles_phone_format_check",
      sql`${table.phone} is null or ${table.phone} ~ '^[0-9+() -]{7,20}$'`
    ),
    check(
      "staff_profiles_job_title_not_blank_check",
      sql`${table.jobTitle} is null or length(trim(${table.jobTitle})) > 0`
    ),
  ]
);

export const hostelBlocks = pgTable(
  "hostel_blocks",
  {
    id: serial("id").primaryKey(),
    hostelId: integer("hostel_id")
      .notNull()
      .references(() => hostels.id, { onDelete: "restrict" }),
    code: varchar("code", { length: 20 }).notNull(),
    name: varchar("name", { length: 100 }).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check(
      "hostel_blocks_code_format_check",
      sql`${table.code} ~ '^[A-Z][A-Z0-9-]{0,19}$'`
    ),
    check(
      "hostel_blocks_name_not_blank_check",
      sql`length(trim(${table.name})) > 0`
    ),
    uniqueIndex("hostel_blocks_hostel_code_unique").on(
      table.hostelId,
      table.code
    ),
    index("hostel_blocks_hostel_id_idx").on(table.hostelId),
  ]
);

export const rooms = pgTable(
  "rooms",
  {
    id: serial("id").primaryKey(),
    blockId: integer("block_id")
      .notNull()
      .references(() => hostelBlocks.id, { onDelete: "restrict" }),
    roomNumber: varchar("room_number", { length: 20 }).notNull(),
    floor: integer("floor").notNull(),
    capacity: integer("capacity").notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check(
      "rooms_number_format_check",
      sql`${table.roomNumber} ~ '^[A-Z0-9][A-Z0-9-]{0,19}$'`
    ),
    check("rooms_floor_bounds_check", sql`${table.floor} between 0 and 99`),
    check(
      "rooms_capacity_bounds_check",
      sql`${table.capacity} between 1 and 20`
    ),
    uniqueIndex("rooms_block_number_unique").on(
      table.blockId,
      table.roomNumber
    ),
    index("rooms_block_id_idx").on(table.blockId),
  ]
);

// An allocation is current while vacated_at is null. Closing the row instead
// of replacing it keeps a complete room history for the resident.
export const roomAllocations = pgTable(
  "room_allocations",
  {
    id: serial("id").primaryKey(),
    studentProfileId: integer("student_profile_id")
      .notNull()
      .references(() => studentProfiles.id, { onDelete: "restrict" }),
    roomId: integer("room_id")
      .notNull()
      .references(() => rooms.id, { onDelete: "restrict" }),
    allocatedByUserId: integer("allocated_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    allocatedAt: timestamp("allocated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    vacatedAt: timestamp("vacated_at", { withTimezone: true }),
    vacatedByUserId: integer("vacated_by_user_id").references(() => users.id, {
      onDelete: "restrict",
    }),
    vacateReason: varchar("vacate_reason", { length: 500 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check(
      "room_allocations_dates_check",
      sql`${table.vacatedAt} is null or ${table.vacatedAt} > ${table.allocatedAt}`
    ),
    check(
      "room_allocations_vacancy_details_check",
      sql`(${table.vacatedAt} is null and ${table.vacatedByUserId} is null and ${table.vacateReason} is null) or (${table.vacatedAt} is not null and ${table.vacatedByUserId} is not null and length(trim(${table.vacateReason})) > 0)`
    ),
    uniqueIndex("room_allocations_one_active_per_student")
      .on(table.studentProfileId)
      .where(sql`${table.vacatedAt} is null`),
    index("room_allocations_active_room_idx")
      .on(table.roomId)
      .where(sql`${table.vacatedAt} is null`),
    index("room_allocations_student_history_idx").on(
      table.studentProfileId,
      table.allocatedAt
    ),
  ]
);

// Staff accounts are activated only after a recipient consumes a one-time invite.
// Raw invitation tokens never enter the database; only their SHA-256 hashes do.
export const staffInvitations = pgTable(
  "staff_invitations",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    email: varchar("email", { length: 255 }).notNull(),
    role: userRoleEnum("role").notNull(),
    tokenHash: varchar("token_hash", { length: 64 }).notNull().unique(),
    invitedByUserId: integer("invited_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check(
      "staff_invitations_role_check",
      sql`${table.role} in ('warden', 'maintenance', 'guard')`
    ),
    uniqueIndex("staff_invitations_active_email_unique")
      .on(table.email)
      .where(sql`${table.acceptedAt} is null and ${table.revokedAt} is null`),
    index("staff_invitations_expires_at_idx").on(table.expiresAt),
    index("staff_invitations_invited_by_user_id_idx").on(
      table.invitedByUserId
    ),
  ]
);

export const staffInvitationHostels = pgTable(
  "staff_invitation_hostels",
  {
    id: serial("id").primaryKey(),
    invitationId: integer("invitation_id")
      .notNull()
      .references(() => staffInvitations.id, { onDelete: "cascade" }),
    hostelId: integer("hostel_id")
      .notNull()
      .references(() => hostels.id, { onDelete: "restrict" }),
    isPrimary: boolean("is_primary").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("staff_invitation_hostels_invitation_hostel_unique").on(
      table.invitationId,
      table.hostelId
    ),
    uniqueIndex("staff_invitation_hostels_one_primary_per_invitation")
      .on(table.invitationId)
      .where(sql`${table.isPrimary} = true`),
    index("staff_invitation_hostels_hostel_id_idx").on(table.hostelId),
  ]
);

// Students can activate accounts only after an administrator approves their
// institutional identity and hostel assignment.
export const approvedStudents = pgTable(
  "approved_students",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    email: varchar("email", { length: 255 }).notNull().unique(),
    rollNo: varchar("roll_no", { length: 50 }).notNull().unique(),
    hostelId: integer("hostel_id")
      .notNull()
      .references(() => hostels.id, { onDelete: "restrict" }),
    approvedByUserId: integer("approved_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    activatedUserId: integer("activated_user_id")
      .unique()
      .references(() => users.id, { onDelete: "restrict" }),
    approvedAt: timestamp("approved_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    activatedAt: timestamp("activated_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check(
      "approved_students_email_normalized_check",
      sql`${table.email} = lower(${table.email})`
    ),
    check(
      "approved_students_roll_no_not_blank_check",
      sql`length(trim(${table.rollNo})) > 0`
    ),
    index("approved_students_hostel_id_idx").on(table.hostelId),
    index("approved_students_approved_by_user_id_idx").on(
      table.approvedByUserId
    ),
  ]
);

export const studentActivationTokens = pgTable(
  "student_activation_tokens",
  {
    id: serial("id").primaryKey(),
    approvedStudentId: integer("approved_student_id")
      .notNull()
      .references(() => approvedStudents.id, { onDelete: "cascade" }),
    tokenHash: varchar("token_hash", { length: 64 }).notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("student_activation_tokens_one_active_per_student")
      .on(table.approvedStudentId)
      .where(sql`${table.usedAt} is null and ${table.revokedAt} is null`),
    index("student_activation_tokens_expires_at_idx").on(table.expiresAt),
  ]
);

// Audit events are append-only records with actor and hostel snapshots. They do
// not depend on source records remaining active or present.
export const auditEvents = pgTable(
  "audit_events",
  {
    id: serial("id").primaryKey(),
    actorUserId: integer("actor_user_id"),
    actorName: varchar("actor_name", { length: 255 }).notNull(),
    actorEmail: varchar("actor_email", { length: 255 }),
    actorRole: varchar("actor_role", { length: 50 }).notNull(),
    category: varchar("category", { length: 50 }).notNull(),
    action: varchar("action", { length: 100 }).notNull(),
    resourceType: varchar("resource_type", { length: 100 }).notNull(),
    resourceId: varchar("resource_id", { length: 100 }).notNull(),
    description: varchar("description", { length: 500 }).notNull(),
    metadata: jsonb("metadata").default(sql`'{}'::jsonb`).notNull(),
    requestId: varchar("request_id", { length: 100 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check(
      "audit_events_action_not_blank_check",
      sql`length(trim(${table.action})) > 0`
    ),
    check(
      "audit_events_resource_not_blank_check",
      sql`length(trim(${table.resourceType})) > 0 and length(trim(${table.resourceId})) > 0`
    ),
    check(
      "audit_events_metadata_object_check",
      sql`jsonb_typeof(${table.metadata}) = 'object'`
    ),
    index("audit_events_created_at_idx").on(table.createdAt),
    index("audit_events_actor_user_id_idx").on(table.actorUserId),
    index("audit_events_action_idx").on(table.action),
    index("audit_events_category_created_at_idx").on(
      table.category,
      table.createdAt
    ),
    index("audit_events_resource_idx").on(
      table.resourceType,
      table.resourceId
    ),
  ]
);

export const auditEventHostels = pgTable(
  "audit_event_hostels",
  {
    id: serial("id").primaryKey(),
    auditEventId: integer("audit_event_id")
      .notNull()
      .references(() => auditEvents.id, { onDelete: "cascade" }),
    hostelId: integer("hostel_id").notNull(),
    hostelCode: varchar("hostel_code", { length: 20 }).notNull(),
  },
  (table) => [
    uniqueIndex("audit_event_hostels_event_hostel_unique").on(
      table.auditEventId,
      table.hostelId
    ),
    index("audit_event_hostels_hostel_id_idx").on(table.hostelId),
  ]
);

// The old complaint API remains connected to these tables until CMP-02 switches
// its handlers to the normalized workflow below. Keeping the legacy names
// explicit prevents new code from accidentally building on the old model.
export const legacyComplaints = pgTable("legacy_complaints", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  type: varchar("type", { length: 100 }).notNull(),
  room: varchar("room", { length: 50 }).notNull(),
  description: text("description").notNull(),
  image: varchar("image", { length: 500 }),
  priority: varchar("priority", { length: 50 }).default("P2 - Medium").notNull(), // P0 - Critical, P1 - High, P2 - Medium, P3 - Low
  slaDeadline: timestamp("sla_deadline"),
  resolutionNote: text("resolution_note"),
  status: varchar("status", { length: 50 }).default("Created").notNull(), // Created, In Progress, Resolved, Closed
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const legacyComplaintTimelines = pgTable("legacy_complaint_timelines", {
  id: serial("id").primaryKey(),
  complaintId: integer("complaint_id")
    .notNull()
    .references(() => legacyComplaints.id, { onDelete: "cascade" }),
  status: varchar("status", { length: 50 }).notNull(),
  note: text("note"),
  time: timestamp("time").defaultNow(),
});

export const complaintCategories = pgTable(
  "complaint_categories",
  {
    id: serial("id").primaryKey(),
    code: varchar("code", { length: 50 }).notNull().unique(),
    name: varchar("name", { length: 100 }).notNull().unique(),
    defaultPriority: complaintPriorityEnum("default_priority").notNull(),
    slaMinutes: integer("sla_minutes").notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check(
      "complaint_categories_code_format_check",
      sql`${table.code} ~ '^[a-z][a-z0-9_]{1,49}$'`
    ),
    check(
      "complaint_categories_name_not_blank_check",
      sql`length(trim(${table.name})) > 0`
    ),
    check(
      "complaint_categories_sla_bounds_check",
      sql`${table.slaMinutes} between 15 and 43200`
    ),
  ]
);

export const complaints = pgTable(
  "complaints",
  {
    id: serial("id").primaryKey(),
    hostelId: integer("hostel_id")
      .notNull()
      .references(() => hostels.id, { onDelete: "restrict" }),
    reportedByUserId: integer("reported_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    studentProfileId: integer("student_profile_id").references(
      () => studentProfiles.id,
      { onDelete: "restrict" }
    ),
    categoryId: integer("category_id")
      .notNull()
      .references(() => complaintCategories.id, { onDelete: "restrict" }),
    roomId: integer("room_id").references(() => rooms.id, {
      onDelete: "restrict",
    }),
    location: varchar("location", { length: 255 }).notNull(),
    description: text("description").notNull(),
    requestedPriority: complaintPriorityEnum("requested_priority"),
    priority: complaintPriorityEnum("priority").notNull(),
    slaPolicyMinutes: integer("sla_policy_minutes").notNull(),
    slaDeadline: timestamp("sla_deadline", { withTimezone: true }).notNull(),
    slaBreachedAt: timestamp("sla_breached_at", { withTimezone: true }),
    status: complaintStatusEnum("status")
      .default(COMPLAINT_STATUSES.CREATED)
      .notNull(),
    resolutionNote: text("resolution_note"),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check(
      "complaints_location_not_blank_check",
      sql`length(trim(${table.location})) > 0`
    ),
    check(
      "complaints_description_length_check",
      sql`length(trim(${table.description})) between 10 and 2000`
    ),
    check(
      "complaints_sla_policy_bounds_check",
      sql`${table.slaPolicyMinutes} between 15 and 43200`
    ),
    check(
      "complaints_sla_deadline_check",
      sql`${table.slaDeadline} > ${table.createdAt}`
    ),
    check(
      "complaints_sla_breached_at_check",
      sql`${table.slaBreachedAt} is null or ${table.slaBreachedAt} >= ${table.slaDeadline}`
    ),
    check(
      "complaints_resolution_details_check",
      sql`(${table.resolvedAt} is null and ${table.resolutionNote} is null) or (${table.resolvedAt} is not null and ${table.resolvedAt} >= ${table.createdAt} and length(trim(${table.resolutionNote})) > 0)`
    ),
    check(
      "complaints_resolved_state_check",
      sql`${table.status} not in ('resolved', 'closed') or ${table.resolvedAt} is not null`
    ),
    check(
      "complaints_closed_state_check",
      sql`(${table.status} = 'closed' and ${table.closedAt} is not null and ${table.closedAt} >= ${table.resolvedAt}) or (${table.status} <> 'closed' and ${table.closedAt} is null)`
    ),
    check(
      "complaints_updated_at_check",
      sql`${table.updatedAt} >= ${table.createdAt}`
    ),
    index("complaints_hostel_status_created_idx").on(
      table.hostelId,
      table.status,
      table.createdAt
    ),
    index("complaints_open_sla_idx")
      .on(table.hostelId, table.slaDeadline)
      .where(sql`${table.status} <> 'closed'`),
    index("complaints_pending_sla_breach_idx")
      .on(table.slaDeadline)
      .where(
        sql`${table.status} in ('created', 'assigned', 'in_progress') and ${table.slaBreachedAt} is null`
      ),
    index("complaints_student_profile_idx").on(
      table.studentProfileId,
      table.createdAt
    ),
    index("complaints_reporter_idx").on(table.reportedByUserId),
    index("complaints_category_idx").on(table.categoryId),
  ]
);

// Assignment rows are closed instead of replaced, which keeps every hand-off.
export const complaintAssignments = pgTable(
  "complaint_assignments",
  {
    id: serial("id").primaryKey(),
    complaintId: integer("complaint_id")
      .notNull()
      .references(() => complaints.id, { onDelete: "restrict" }),
    assigneeUserId: integer("assignee_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    assignedByUserId: integer("assigned_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    assignedAt: timestamp("assigned_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    endedByUserId: integer("ended_by_user_id").references(() => users.id, {
      onDelete: "restrict",
    }),
    endReason: varchar("end_reason", { length: 500 }),
  },
  (table) => [
    check(
      "complaint_assignments_end_details_check",
      sql`(${table.endedAt} is null and ${table.endedByUserId} is null and ${table.endReason} is null) or (${table.endedAt} is not null and ${table.endedAt} > ${table.assignedAt} and ${table.endedByUserId} is not null and length(trim(${table.endReason})) > 0)`
    ),
    uniqueIndex("complaint_assignments_one_active_per_complaint")
      .on(table.complaintId)
      .where(sql`${table.endedAt} is null`),
    index("complaint_assignments_active_assignee_idx")
      .on(table.assigneeUserId, table.assignedAt)
      .where(sql`${table.endedAt} is null`),
    index("complaint_assignments_history_idx").on(
      table.complaintId,
      table.assignedAt
    ),
  ]
);

// Events are append-only. Actor fields are snapshots so the timeline remains
// readable even when an account is later renamed or deactivated.
export const complaintEvents = pgTable(
  "complaint_events",
  {
    id: serial("id").primaryKey(),
    complaintId: integer("complaint_id")
      .notNull()
      .references(() => complaints.id, { onDelete: "restrict" }),
    eventType: complaintEventTypeEnum("event_type").notNull(),
    fromStatus: complaintStatusEnum("from_status"),
    toStatus: complaintStatusEnum("to_status").notNull(),
    actorUserId: integer("actor_user_id").references(() => users.id, {
      onDelete: "restrict",
    }),
    actorName: varchar("actor_name", { length: 255 }).notNull(),
    actorRole: varchar("actor_role", { length: 50 }).notNull(),
    note: varchar("note", { length: 1000 }),
    metadata: jsonb("metadata").default(sql`'{}'::jsonb`).notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check(
      "complaint_events_created_state_check",
      sql`(${table.eventType} = 'created' and ${table.fromStatus} is null and ${table.toStatus} = 'created') or (${table.eventType} <> 'created' and ${table.fromStatus} is not null)`
    ),
    check(
      "complaint_events_actor_snapshot_check",
      sql`length(trim(${table.actorName})) > 0 and length(trim(${table.actorRole})) > 0`
    ),
    check(
      "complaint_events_note_not_blank_check",
      sql`${table.note} is null or length(trim(${table.note})) > 0`
    ),
    check(
      "complaint_events_metadata_object_check",
      sql`jsonb_typeof(${table.metadata}) = 'object'`
    ),
    index("complaint_events_timeline_idx").on(
      table.complaintId,
      table.occurredAt,
      table.id
    ),
    index("complaint_events_actor_idx").on(table.actorUserId),
  ]
);

// Only storage keys are persisted. Routes must authorize access and return a
// short-lived download response; this table never exposes a public file URL.
export const complaintAttachments = pgTable(
  "complaint_attachments",
  {
    id: serial("id").primaryKey(),
    complaintId: integer("complaint_id")
      .notNull()
      .references(() => complaints.id, { onDelete: "restrict" }),
    eventId: integer("event_id").references(() => complaintEvents.id, {
      onDelete: "restrict",
    }),
    uploadedByUserId: integer("uploaded_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    purpose: complaintAttachmentPurposeEnum("purpose").notNull(),
    storageKey: varchar("storage_key", { length: 500 }).notNull().unique(),
    originalName: varchar("original_name", { length: 255 }).notNull(),
    mimeType: varchar("mime_type", { length: 100 }).notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    sha256: varchar("sha256", { length: 64 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check(
      "complaint_attachments_storage_key_check",
      sql`length(trim(${table.storageKey})) > 0`
    ),
    check(
      "complaint_attachments_original_name_check",
      sql`length(trim(${table.originalName})) > 0`
    ),
    check(
      "complaint_attachments_mime_type_check",
      sql`${table.mimeType} in ('image/jpeg', 'image/png', 'image/webp')`
    ),
    check(
      "complaint_attachments_size_check",
      sql`${table.sizeBytes} between 1 and 5242880`
    ),
    check(
      "complaint_attachments_sha256_check",
      sql`${table.sha256} ~ '^[a-f0-9]{64}$'`
    ),
    index("complaint_attachments_complaint_idx").on(
      table.complaintId,
      table.createdAt
    ),
  ]
);

// The original leave and gate APIs remain connected to these tables until the
// normalized workflow is implemented. New code must use the tables below.
export const legacyLeaves = pgTable("legacy_leaves", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  reason: text("reason"),
  fromDate: varchar("from_date", { length: 100 }),
  toDate: varchar("to_date", { length: 100 }),
  status: varchar("status", { length: 50 }).default("Pending").notNull(), // Pending, Approved, Rejected, Exited, Returned
  passCode: varchar("pass_code", { length: 50 }), // e.g. LP-4921
  adminSignature: text("admin_signature"),
  pdfFile: varchar("pdf_file", { length: 500 }),
  leftAt: timestamp("left_at"),
  returnedAt: timestamp("returned_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const legacyGateLogs = pgTable("legacy_gate_logs", {
  id: serial("id").primaryKey(),
  leaveId: integer("leave_id")
    .notNull()
    .references(() => legacyLeaves.id, { onDelete: "cascade" }),
  studentId: integer("student_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  guardId: integer("guard_id").references(() => users.id),
  action: varchar("action", { length: 20 }).notNull(), // "EXIT" | "ENTRY"
  scannedAt: timestamp("scanned_at").defaultNow(),
  remarks: text("remarks"),
});

export const leaveRequests = pgTable(
  "leave_requests",
  {
    id: serial("id").primaryKey(),
    hostelId: integer("hostel_id")
      .notNull()
      .references(() => hostels.id, { onDelete: "restrict" }),
    studentUserId: integer("student_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    studentProfileId: integer("student_profile_id")
      .notNull()
      .references(() => studentProfiles.id, { onDelete: "restrict" }),
    roomAllocationId: integer("room_allocation_id").references(
      () => roomAllocations.id,
      { onDelete: "restrict" }
    ),
    reason: text("reason").notNull(),
    departureAt: timestamp("departure_at", { withTimezone: true }).notNull(),
    expectedReturnAt: timestamp("expected_return_at", {
      withTimezone: true,
    }).notNull(),
    isEmergency: boolean("is_emergency").default(false).notNull(),
    status: leaveStatusEnum("status")
      .default(LEAVE_STATUSES.PENDING)
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check(
      "leave_requests_reason_length_check",
      sql`length(trim(${table.reason})) between 5 and 1000`
    ),
    check(
      "leave_requests_departure_future_check",
      sql`${table.departureAt} > ${table.createdAt}`
    ),
    check(
      "leave_requests_date_order_check",
      sql`${table.expectedReturnAt} > ${table.departureAt}`
    ),
    check(
      "leave_requests_updated_at_check",
      sql`${table.updatedAt} >= ${table.createdAt}`
    ),
    index("leave_requests_student_status_idx").on(
      table.studentUserId,
      table.status,
      table.departureAt
    ),
    index("leave_requests_hostel_status_departure_idx").on(
      table.hostelId,
      table.status,
      table.departureAt
    ),
    index("leave_requests_outside_return_idx")
      .on(table.hostelId, table.expectedReturnAt)
      .where(sql`${table.status} = 'exited'`),
    index("leave_requests_room_allocation_idx").on(table.roomAllocationId),
  ]
);

// A decision is a separate immutable record instead of editable columns on the
// leave request. This preserves exactly who decided and what note they gave.
export const leaveDecisions = pgTable(
  "leave_decisions",
  {
    id: serial("id").primaryKey(),
    leaveRequestId: integer("leave_request_id")
      .notNull()
      .unique()
      .references(() => leaveRequests.id, { onDelete: "restrict" }),
    outcome: leaveDecisionOutcomeEnum("outcome").notNull(),
    decidedByUserId: integer("decided_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    actorName: varchar("actor_name", { length: 255 }).notNull(),
    actorRole: varchar("actor_role", { length: 50 }).notNull(),
    note: varchar("note", { length: 1000 }).notNull(),
    decidedAt: timestamp("decided_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check(
      "leave_decisions_actor_snapshot_check",
      sql`length(trim(${table.actorName})) > 0 and length(trim(${table.actorRole})) > 0`
    ),
    check(
      "leave_decisions_note_length_check",
      sql`length(trim(${table.note})) between 5 and 1000`
    ),
    index("leave_decisions_actor_idx").on(
      table.decidedByUserId,
      table.decidedAt
    ),
  ]
);

// Only the SHA-256 hash of the bearer token is stored. Sequential IDs are never
// accepted as pass credentials.
export const gatePasses = pgTable(
  "gate_passes",
  {
    id: serial("id").primaryKey(),
    leaveRequestId: integer("leave_request_id")
      .notNull()
      .unique()
      .references(() => leaveRequests.id, { onDelete: "restrict" }),
    tokenHash: varchar("token_hash", { length: 64 }).notNull().unique(),
    issuedByUserId: integer("issued_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    issuedAt: timestamp("issued_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    validFrom: timestamp("valid_from", { withTimezone: true }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    qrStorageKey: varchar("qr_storage_key", { length: 500 }).unique(),
    pdfStorageKey: varchar("pdf_storage_key", { length: 500 }).unique(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    revokedByUserId: integer("revoked_by_user_id").references(() => users.id, {
      onDelete: "restrict",
    }),
    revocationReason: varchar("revocation_reason", { length: 1000 }),
  },
  (table) => [
    check(
      "gate_passes_token_hash_check",
      sql`${table.tokenHash} ~ '^[a-f0-9]{64}$'`
    ),
    check(
      "gate_passes_validity_check",
      sql`${table.validFrom} >= ${table.issuedAt} and ${table.expiresAt} > ${table.validFrom}`
    ),
    check(
      "gate_passes_qr_storage_key_check",
      sql`${table.qrStorageKey} is null or length(trim(${table.qrStorageKey})) > 0`
    ),
    check(
      "gate_passes_pdf_storage_key_check",
      sql`${table.pdfStorageKey} is null or length(trim(${table.pdfStorageKey})) > 0`
    ),
    check(
      "gate_passes_revocation_details_check",
      sql`(${table.revokedAt} is null and ${table.revokedByUserId} is null and ${table.revocationReason} is null) or (${table.revokedAt} is not null and ${table.revokedAt} >= ${table.issuedAt} and ${table.revokedByUserId} is not null and length(trim(${table.revocationReason})) between 5 and 1000)`
    ),
    index("gate_passes_active_expiry_idx")
      .on(table.expiresAt)
      .where(sql`${table.revokedAt} is null`),
    index("gate_passes_issuer_idx").on(table.issuedByUserId, table.issuedAt),
  ]
);

export const leaveEvents = pgTable(
  "leave_events",
  {
    id: serial("id").primaryKey(),
    leaveRequestId: integer("leave_request_id")
      .notNull()
      .references(() => leaveRequests.id, { onDelete: "restrict" }),
    eventType: leaveEventTypeEnum("event_type").notNull(),
    fromStatus: leaveStatusEnum("from_status"),
    toStatus: leaveStatusEnum("to_status").notNull(),
    actorUserId: integer("actor_user_id").references(() => users.id, {
      onDelete: "restrict",
    }),
    actorName: varchar("actor_name", { length: 255 }).notNull(),
    actorRole: varchar("actor_role", { length: 50 }).notNull(),
    note: varchar("note", { length: 1000 }),
    metadata: jsonb("metadata").default(sql`'{}'::jsonb`).notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check(
      "leave_events_submitted_state_check",
      sql`(${table.eventType} = 'submitted' and ${table.fromStatus} is null and ${table.toStatus} = 'pending') or (${table.eventType} <> 'submitted' and ${table.fromStatus} is not null)`
    ),
    check(
      "leave_events_actor_snapshot_check",
      sql`length(trim(${table.actorName})) > 0 and length(trim(${table.actorRole})) > 0`
    ),
    check(
      "leave_events_note_not_blank_check",
      sql`${table.note} is null or length(trim(${table.note})) > 0`
    ),
    check(
      "leave_events_metadata_object_check",
      sql`jsonb_typeof(${table.metadata}) = 'object'`
    ),
    index("leave_events_timeline_idx").on(
      table.leaveRequestId,
      table.occurredAt,
      table.id
    ),
    index("leave_events_actor_idx").on(table.actorUserId),
  ]
);

export const gateEvents = pgTable(
  "gate_events",
  {
    id: serial("id").primaryKey(),
    leaveRequestId: integer("leave_request_id")
      .notNull()
      .references(() => leaveRequests.id, { onDelete: "restrict" }),
    gatePassId: integer("gate_pass_id").references(() => gatePasses.id, {
      onDelete: "restrict",
    }),
    movement: gateMovementEnum("movement").notNull(),
    verificationMethod: gateVerificationMethodEnum(
      "verification_method"
    ).notNull(),
    performedByUserId: integer("performed_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    actorName: varchar("actor_name", { length: 255 }).notNull(),
    actorRole: varchar("actor_role", { length: 50 }).notNull(),
    idempotencyKey: varchar("idempotency_key", { length: 100 })
      .notNull()
      .unique(),
    note: varchar("note", { length: 1000 }),
    metadata: jsonb("metadata").default(sql`'{}'::jsonb`).notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check(
      "gate_events_actor_snapshot_check",
      sql`length(trim(${table.actorName})) > 0 and length(trim(${table.actorRole})) > 0`
    ),
    check(
      "gate_events_idempotency_key_check",
      sql`length(trim(${table.idempotencyKey})) between 16 and 100`
    ),
    check(
      "gate_events_pass_required_check",
      sql`${table.verificationMethod} = 'override' or ${table.gatePassId} is not null`
    ),
    check(
      "gate_events_override_note_check",
      sql`${table.verificationMethod} <> 'override' or (${table.note} is not null and length(trim(${table.note})) between 5 and 1000)`
    ),
    check(
      "gate_events_metadata_object_check",
      sql`jsonb_typeof(${table.metadata}) = 'object'`
    ),
    uniqueIndex("gate_events_one_movement_per_leave")
      .on(table.leaveRequestId, table.movement),
    index("gate_events_activity_idx").on(table.occurredAt, table.id),
    index("gate_events_actor_idx").on(
      table.performedByUserId,
      table.occurredAt
    ),
  ]
);

// 6. Mess Issues Table
export const messIssues = pgTable("mess_issues", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  studentName: varchar("student_name", { length: 255 }).notNull(),
  issueType: varchar("issue_type", { length: 100 }),
  mealType: varchar("meal_type", { length: 100 }),
  description: text("description"),
  image: varchar("image", { length: 500 }),
  status: varchar("status", { length: 50 }).default("Pending").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// 7. Mess Menus Table
export const messMenus = pgTable("mess_menus", {
  id: serial("id").primaryKey(),
  menuDate: timestamp("menu_date").notNull().unique(),
  breakfast: text("breakfast"),
  lunch: text("lunch"),
  dinner: text("dinner"),
  createdAt: timestamp("created_at").defaultNow(),
});

// 8. Mess Feedbacks Table
export const messFeedbacks = pgTable("mess_feedbacks", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  mealType: varchar("meal_type", { length: 100 }),
  foodItem: varchar("food_item", { length: 255 }),
  rating: integer("rating"),
  feedbackDate: timestamp("feedback_date").defaultNow(),
});

// 9. Menu Votes Table
export const menuVotes = pgTable("menu_votes", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  mealType: varchar("meal_type", { length: 100 }),
  oldItem: varchar("old_item", { length: 255 }),
  suggestedItem: varchar("suggested_item", { length: 255 }),
  voteDate: timestamp("vote_date").defaultNow(),
});
