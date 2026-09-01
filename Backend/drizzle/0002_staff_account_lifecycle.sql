CREATE TABLE "staff_invitation_hostels" (
	"id" serial PRIMARY KEY NOT NULL,
	"invitation_id" integer NOT NULL,
	"hostel_id" integer NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staff_invitations" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"role" "user_role" NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"invited_by_user_id" integer NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "staff_invitations_token_hash_unique" UNIQUE("token_hash"),
	CONSTRAINT "staff_invitations_role_check" CHECK ("staff_invitations"."role" in ('warden', 'maintenance', 'guard'))
);
--> statement-breakpoint
ALTER TABLE "staff_invitation_hostels" ADD CONSTRAINT "staff_invitation_hostels_invitation_id_staff_invitations_id_fk" FOREIGN KEY ("invitation_id") REFERENCES "public"."staff_invitations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_invitation_hostels" ADD CONSTRAINT "staff_invitation_hostels_hostel_id_hostels_id_fk" FOREIGN KEY ("hostel_id") REFERENCES "public"."hostels"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_invitations" ADD CONSTRAINT "staff_invitations_invited_by_user_id_users_id_fk" FOREIGN KEY ("invited_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "staff_invitation_hostels_invitation_hostel_unique" ON "staff_invitation_hostels" USING btree ("invitation_id","hostel_id");--> statement-breakpoint
CREATE UNIQUE INDEX "staff_invitation_hostels_one_primary_per_invitation" ON "staff_invitation_hostels" USING btree ("invitation_id") WHERE "staff_invitation_hostels"."is_primary" = true;--> statement-breakpoint
CREATE INDEX "staff_invitation_hostels_hostel_id_idx" ON "staff_invitation_hostels" USING btree ("hostel_id");--> statement-breakpoint
CREATE UNIQUE INDEX "staff_invitations_active_email_unique" ON "staff_invitations" USING btree ("email") WHERE "staff_invitations"."accepted_at" is null and "staff_invitations"."revoked_at" is null;--> statement-breakpoint
CREATE INDEX "staff_invitations_expires_at_idx" ON "staff_invitations" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "staff_invitations_invited_by_user_id_idx" ON "staff_invitations" USING btree ("invited_by_user_id");