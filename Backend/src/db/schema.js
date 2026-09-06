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
import { USER_ROLES } from "../domain/roles.js";

export const userRoleEnum = pgEnum("user_role", Object.values(USER_ROLES));
export const accountStatusEnum = pgEnum(
  "account_status",
  Object.values(ACCOUNT_STATUSES)
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

// 2. Complaints Table
export const complaints = pgTable("complaints", {
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

// 3. Complaint Timelines Table
export const complaintTimelines = pgTable("complaint_timelines", {
  id: serial("id").primaryKey(),
  complaintId: integer("complaint_id")
    .notNull()
    .references(() => complaints.id, { onDelete: "cascade" }),
  status: varchar("status", { length: 50 }).notNull(),
  note: text("note"),
  time: timestamp("time").defaultNow(),
});

// 4. Leave Applications Table (With Gate Security State Machine)
export const leaves = pgTable("leaves", {
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

// 5. Gate Access Logs (Real-time Gate Attendance Logging)
export const gateLogs = pgTable("gate_logs", {
  id: serial("id").primaryKey(),
  leaveId: integer("leave_id")
    .notNull()
    .references(() => leaves.id, { onDelete: "cascade" }),
  studentId: integer("student_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  guardId: integer("guard_id").references(() => users.id),
  action: varchar("action", { length: 20 }).notNull(), // "EXIT" | "ENTRY"
  scannedAt: timestamp("scanned_at").defaultNow(),
  remarks: text("remarks"),
});

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
