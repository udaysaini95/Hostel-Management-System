CREATE TYPE "public"."account_status" AS ENUM('pending', 'active', 'suspended');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('student', 'warden', 'maintenance', 'guard', 'admin');--> statement-breakpoint
CREATE TABLE "gate_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"leave_id" integer NOT NULL,
	"student_id" integer NOT NULL,
	"guard_id" integer,
	"action" varchar(20) NOT NULL,
	"scanned_at" timestamp DEFAULT now(),
	"remarks" text
);
--> statement-breakpoint
CREATE TABLE "hostel_memberships" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"hostel_id" integer NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hostels" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" varchar(20) NOT NULL,
	"name" varchar(255) NOT NULL,
	"address" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "hostels_code_unique" UNIQUE("code"),
	CONSTRAINT "hostels_name_unique" UNIQUE("name"),
	CONSTRAINT "hostels_code_format_check" CHECK ("hostels"."code" ~ '^[A-Z][A-Z0-9-]{0,19}$')
);
--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "role" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "role" SET DATA TYPE "public"."user_role" USING "role"::"public"."user_role";--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'student';--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "account_status" "account_status" DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "email_verified_at" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "last_login_at" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "roll_no" varchar(50);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "phone" varchar(50);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "room_no" varchar(50);--> statement-breakpoint
ALTER TABLE "complaints" ADD COLUMN "priority" varchar(50) DEFAULT 'P2 - Medium' NOT NULL;--> statement-breakpoint
ALTER TABLE "complaints" ADD COLUMN "sla_deadline" timestamp;--> statement-breakpoint
ALTER TABLE "complaints" ADD COLUMN "resolution_note" text;--> statement-breakpoint
ALTER TABLE "complaint_timelines" ADD COLUMN "note" text;--> statement-breakpoint
ALTER TABLE "leaves" ADD COLUMN "pass_code" varchar(50);--> statement-breakpoint
ALTER TABLE "leaves" ADD COLUMN "left_at" timestamp;--> statement-breakpoint
ALTER TABLE "leaves" ADD COLUMN "returned_at" timestamp;--> statement-breakpoint
ALTER TABLE "gate_logs" ADD CONSTRAINT "gate_logs_leave_id_leaves_id_fk" FOREIGN KEY ("leave_id") REFERENCES "public"."leaves"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gate_logs" ADD CONSTRAINT "gate_logs_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gate_logs" ADD CONSTRAINT "gate_logs_guard_id_users_id_fk" FOREIGN KEY ("guard_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hostel_memberships" ADD CONSTRAINT "hostel_memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hostel_memberships" ADD CONSTRAINT "hostel_memberships_hostel_id_hostels_id_fk" FOREIGN KEY ("hostel_id") REFERENCES "public"."hostels"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "hostel_memberships_user_hostel_unique" ON "hostel_memberships" USING btree ("user_id","hostel_id");--> statement-breakpoint
CREATE UNIQUE INDEX "hostel_memberships_one_primary_per_user" ON "hostel_memberships" USING btree ("user_id") WHERE "hostel_memberships"."is_primary" = true;--> statement-breakpoint
CREATE INDEX "hostel_memberships_hostel_id_idx" ON "hostel_memberships" USING btree ("hostel_id");--> statement-breakpoint
CREATE INDEX "users_account_status_idx" ON "users" USING btree ("account_status");
