CREATE TYPE "notification_event_type" AS ENUM (
  'complaint_reported',
  'complaint_assigned',
  'complaint_resolved',
  'leave_submitted',
  'leave_decided',
  'gate_movement',
  'important_notice'
);

CREATE TABLE "notifications" (
  "id" serial PRIMARY KEY NOT NULL,
  "recipient_user_id" integer NOT NULL,
  "event_type" "notification_event_type" NOT NULL,
  "title" varchar(160) NOT NULL,
  "message" varchar(500) NOT NULL,
  "resource_type" varchar(50) NOT NULL,
  "resource_id" integer NOT NULL,
  "link_path" varchar(500) NOT NULL,
  "dedupe_key" varchar(200) NOT NULL UNIQUE,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "read_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "notifications_title_check" CHECK (length(trim("title")) between 1 and 160),
  CONSTRAINT "notifications_message_check" CHECK (length(trim("message")) between 1 and 500),
  CONSTRAINT "notifications_resource_id_check" CHECK ("resource_id" > 0),
  CONSTRAINT "notifications_link_path_check" CHECK (
    "link_path" ~ '^/(admin/complaints|maintenance/work-orders|student/complaints/[1-9][0-9]*|admin/leaves|student/leaves|notices)$'
  ),
  CONSTRAINT "notifications_dedupe_key_check" CHECK (length(trim("dedupe_key")) between 1 and 200),
  CONSTRAINT "notifications_metadata_object_check" CHECK (jsonb_typeof("metadata") = 'object'),
  CONSTRAINT "notifications_read_date_check" CHECK ("read_at" is null or "read_at" >= "created_at")
);

ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipient_user_id_users_id_fk"
  FOREIGN KEY ("recipient_user_id") REFERENCES "public"."users"("id")
  ON DELETE restrict ON UPDATE no action;

CREATE INDEX "notifications_recipient_feed_idx"
  ON "notifications" ("recipient_user_id", "created_at", "id");
CREATE INDEX "notifications_recipient_unread_idx"
  ON "notifications" ("recipient_user_id", "read_at");

CREATE OR REPLACE FUNCTION validate_notification_target()
RETURNS trigger AS $$
DECLARE
  recipient_role text;
  recipient_status text;
BEGIN
  SELECT "role"::text, "account_status"::text
  INTO recipient_role, recipient_status
  FROM "users"
  WHERE "id" = NEW."recipient_user_id";

  IF recipient_status IS DISTINCT FROM 'active' THEN
    RAISE EXCEPTION 'Notification recipient must have an active account'
      USING ERRCODE = '42501';
  END IF;
  IF NEW."read_at" IS NOT NULL THEN
    RAISE EXCEPTION 'New notifications must start unread'
      USING ERRCODE = '23514';
  END IF;

  IF NEW."event_type" = 'complaint_reported' AND (
    recipient_role NOT IN ('warden', 'admin')
    OR NEW."resource_type" <> 'complaint'
    OR NEW."link_path" <> '/admin/complaints'
    OR NOT EXISTS (
      SELECT 1 FROM "complaints" c
      WHERE c."id" = NEW."resource_id"
        AND (
          recipient_role = 'admin'
          OR EXISTS (
            SELECT 1 FROM "hostel_memberships" hm
            WHERE hm."user_id" = NEW."recipient_user_id"
              AND hm."hostel_id" = c."hostel_id"
          )
        )
    )
  ) THEN
    RAISE EXCEPTION 'Complaint report notification target is invalid'
      USING ERRCODE = '42501';
  ELSIF NEW."event_type" = 'complaint_assigned' AND (
    recipient_role <> 'maintenance'
    OR NEW."resource_type" <> 'complaint'
    OR NEW."link_path" <> '/maintenance/work-orders'
    OR NOT EXISTS (
      SELECT 1 FROM "complaint_assignments" ca
      WHERE ca."complaint_id" = NEW."resource_id"
        AND ca."assignee_user_id" = NEW."recipient_user_id"
        AND ca."ended_at" IS NULL
    )
  ) THEN
    RAISE EXCEPTION 'Complaint assignment notification target is invalid'
      USING ERRCODE = '42501';
  ELSIF NEW."event_type" = 'complaint_resolved' AND (
    recipient_role <> 'student'
    OR NEW."resource_type" <> 'complaint'
    OR NEW."link_path" <> ('/student/complaints/' || NEW."resource_id"::text)
    OR NOT EXISTS (
      SELECT 1 FROM "complaints" c
      WHERE c."id" = NEW."resource_id"
        AND c."reported_by_user_id" = NEW."recipient_user_id"
    )
  ) THEN
    RAISE EXCEPTION 'Complaint resolution notification target is invalid'
      USING ERRCODE = '42501';
  ELSIF NEW."event_type" = 'leave_submitted' AND (
    recipient_role NOT IN ('warden', 'admin')
    OR NEW."resource_type" <> 'leave_request'
    OR NEW."link_path" <> '/admin/leaves'
    OR NOT EXISTS (
      SELECT 1 FROM "leave_requests" lr
      WHERE lr."id" = NEW."resource_id"
        AND (
          recipient_role = 'admin'
          OR EXISTS (
            SELECT 1 FROM "hostel_memberships" hm
            WHERE hm."user_id" = NEW."recipient_user_id"
              AND hm."hostel_id" = lr."hostel_id"
          )
        )
    )
  ) THEN
    RAISE EXCEPTION 'Leave submission notification target is invalid'
      USING ERRCODE = '42501';
  ELSIF NEW."event_type" = 'leave_decided' AND (
    recipient_role <> 'student'
    OR NEW."resource_type" <> 'leave_request'
    OR NEW."link_path" <> '/student/leaves'
    OR NOT EXISTS (
      SELECT 1 FROM "leave_requests" lr
      WHERE lr."id" = NEW."resource_id"
        AND lr."student_user_id" = NEW."recipient_user_id"
    )
  ) THEN
    RAISE EXCEPTION 'Leave decision notification target is invalid'
      USING ERRCODE = '42501';
  ELSIF NEW."event_type" = 'gate_movement' AND (
    recipient_role <> 'student'
    OR NEW."resource_type" <> 'gate_event'
    OR NEW."link_path" <> '/student/leaves'
    OR NOT EXISTS (
      SELECT 1
      FROM "gate_events" ge
      INNER JOIN "leave_requests" lr ON lr."id" = ge."leave_request_id"
      WHERE ge."id" = NEW."resource_id"
        AND lr."student_user_id" = NEW."recipient_user_id"
    )
  ) THEN
    RAISE EXCEPTION 'Gate movement notification target is invalid'
      USING ERRCODE = '42501';
  ELSIF NEW."event_type" = 'important_notice' AND (
    NEW."resource_type" <> 'notice'
    OR NEW."link_path" <> '/notices'
    OR NOT EXISTS (
      SELECT 1 FROM "notice_recipients" nr
      WHERE nr."notice_id" = NEW."resource_id"
        AND nr."user_id" = NEW."recipient_user_id"
    )
  ) THEN
    RAISE EXCEPTION 'Important notice notification target is invalid'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "notification_target_guard"
BEFORE INSERT ON "notifications"
FOR EACH ROW EXECUTE FUNCTION validate_notification_target();

CREATE OR REPLACE FUNCTION protect_notification()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Notifications cannot be deleted'
      USING ERRCODE = '55000';
  END IF;

  IF NEW."id" IS DISTINCT FROM OLD."id"
    OR NEW."recipient_user_id" IS DISTINCT FROM OLD."recipient_user_id"
    OR NEW."event_type" IS DISTINCT FROM OLD."event_type"
    OR NEW."title" IS DISTINCT FROM OLD."title"
    OR NEW."message" IS DISTINCT FROM OLD."message"
    OR NEW."resource_type" IS DISTINCT FROM OLD."resource_type"
    OR NEW."resource_id" IS DISTINCT FROM OLD."resource_id"
    OR NEW."link_path" IS DISTINCT FROM OLD."link_path"
    OR NEW."dedupe_key" IS DISTINCT FROM OLD."dedupe_key"
    OR NEW."metadata" IS DISTINCT FROM OLD."metadata"
    OR NEW."created_at" IS DISTINCT FROM OLD."created_at"
    OR OLD."read_at" IS NOT NULL
    OR NEW."read_at" IS NULL THEN
    RAISE EXCEPTION 'Only the first notification read timestamp may be recorded'
      USING ERRCODE = '55000';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "notification_update_guard"
BEFORE UPDATE ON "notifications"
FOR EACH ROW EXECUTE FUNCTION protect_notification();

CREATE TRIGGER "notification_delete_guard"
BEFORE DELETE ON "notifications"
FOR EACH ROW EXECUTE FUNCTION protect_notification();
