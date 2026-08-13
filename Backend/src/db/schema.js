import { pgTable, serial, varchar, text, integer, timestamp } from "drizzle-orm/pg-core";

// 1. Users Table
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  password: varchar("password", { length: 255 }).notNull(),
  role: varchar("role", { length: 50 }).default("student").notNull(), // student, warden, guard, admin
  rollNo: varchar("roll_no", { length: 50 }),
  phone: varchar("phone", { length: 50 }),
  roomNo: varchar("room_no", { length: 50 }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

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
