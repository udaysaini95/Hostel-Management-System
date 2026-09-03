CREATE TABLE "approved_students" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"roll_no" varchar(50) NOT NULL,
	"hostel_id" integer NOT NULL,
	"approved_by_user_id" integer NOT NULL,
	"activated_user_id" integer,
	"approved_at" timestamp with time zone DEFAULT now() NOT NULL,
	"activated_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "approved_students_email_unique" UNIQUE("email"),
	CONSTRAINT "approved_students_roll_no_unique" UNIQUE("roll_no"),
	CONSTRAINT "approved_students_activated_user_id_unique" UNIQUE("activated_user_id"),
	CONSTRAINT "approved_students_email_normalized_check" CHECK ("approved_students"."email" = lower("approved_students"."email")),
	CONSTRAINT "approved_students_roll_no_not_blank_check" CHECK (length(trim("approved_students"."roll_no")) > 0)
);
--> statement-breakpoint
CREATE TABLE "student_activation_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"approved_student_id" integer NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "student_activation_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
ALTER TABLE "approved_students" ADD CONSTRAINT "approved_students_hostel_id_hostels_id_fk" FOREIGN KEY ("hostel_id") REFERENCES "public"."hostels"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approved_students" ADD CONSTRAINT "approved_students_approved_by_user_id_users_id_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approved_students" ADD CONSTRAINT "approved_students_activated_user_id_users_id_fk" FOREIGN KEY ("activated_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_activation_tokens" ADD CONSTRAINT "student_activation_tokens_approved_student_id_approved_students_id_fk" FOREIGN KEY ("approved_student_id") REFERENCES "public"."approved_students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "approved_students_hostel_id_idx" ON "approved_students" USING btree ("hostel_id");--> statement-breakpoint
CREATE INDEX "approved_students_approved_by_user_id_idx" ON "approved_students" USING btree ("approved_by_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "student_activation_tokens_one_active_per_student" ON "student_activation_tokens" USING btree ("approved_student_id") WHERE "student_activation_tokens"."used_at" is null and "student_activation_tokens"."revoked_at" is null;--> statement-breakpoint
CREATE INDEX "student_activation_tokens_expires_at_idx" ON "student_activation_tokens" USING btree ("expires_at");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_roll_no_unique" UNIQUE("roll_no");