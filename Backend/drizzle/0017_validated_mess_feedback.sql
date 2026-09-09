ALTER TABLE "mess_feedbacks" RENAME TO "legacy_mess_feedbacks";
ALTER SEQUENCE IF EXISTS "mess_feedbacks_id_seq" RENAME TO "legacy_mess_feedbacks_id_seq";

COMMENT ON TABLE "legacy_mess_feedbacks" IS
  'Archived by migration 0017 because old ratings were not linked to a hostel menu. Reconcile manually before removal.';

CREATE TABLE "mess_feedbacks" (
  "id" serial PRIMARY KEY NOT NULL,
  "menu_id" integer NOT NULL,
  "menu_version_id" integer NOT NULL,
  "student_user_id" integer NOT NULL,
  "meal_type" "mess_meal_type" NOT NULL,
  "rating" integer NOT NULL,
  "comment" varchar(1000),
  "submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "mess_feedbacks_rating_check" CHECK ("rating" between 1 and 5),
  CONSTRAINT "mess_feedbacks_comment_check" CHECK (
    "comment" is null or length(trim("comment")) between 1 and 1000
  )
);

ALTER TABLE "mess_feedbacks"
  ADD CONSTRAINT "mess_feedbacks_menu_id_mess_menus_id_fk"
  FOREIGN KEY ("menu_id") REFERENCES "public"."mess_menus"("id")
  ON DELETE restrict ON UPDATE no action;
ALTER TABLE "mess_feedbacks"
  ADD CONSTRAINT "mess_feedbacks_menu_version_id_mess_menu_versions_id_fk"
  FOREIGN KEY ("menu_version_id") REFERENCES "public"."mess_menu_versions"("id")
  ON DELETE restrict ON UPDATE no action;
ALTER TABLE "mess_feedbacks"
  ADD CONSTRAINT "mess_feedbacks_student_user_id_users_id_fk"
  FOREIGN KEY ("student_user_id") REFERENCES "public"."users"("id")
  ON DELETE restrict ON UPDATE no action;

CREATE UNIQUE INDEX "mess_feedbacks_student_menu_meal_unique"
  ON "mess_feedbacks" USING btree ("student_user_id", "menu_id", "meal_type");
CREATE INDEX "mess_feedbacks_menu_submitted_idx"
  ON "mess_feedbacks" USING btree ("menu_id", "submitted_at");

CREATE OR REPLACE FUNCTION validate_mess_feedback_scope()
RETURNS trigger AS $$
DECLARE
  feedback_hostel_id integer;
  revision_menu_id integer;
  student_role text;
  student_status text;
  student_hostel_id integer;
BEGIN
  SELECT "hostel_id" INTO feedback_hostel_id
  FROM "mess_menus" WHERE "id" = NEW."menu_id";

  SELECT "menu_id" INTO revision_menu_id
  FROM "mess_menu_versions" WHERE "id" = NEW."menu_version_id";

  SELECT "role"::text, "account_status"::text
  INTO student_role, student_status
  FROM "users" WHERE "id" = NEW."student_user_id";

  SELECT "hostel_id" INTO student_hostel_id
  FROM "student_profiles" WHERE "user_id" = NEW."student_user_id";

  IF revision_menu_id IS DISTINCT FROM NEW."menu_id" THEN
    RAISE EXCEPTION 'Feedback revision is outside the selected menu'
      USING ERRCODE = '23514', CONSTRAINT = 'mess_feedback_revision_scope_check';
  END IF;

  IF student_role IS DISTINCT FROM 'student'
    OR student_status IS DISTINCT FROM 'active'
    OR student_hostel_id IS DISTINCT FROM feedback_hostel_id THEN
    RAISE EXCEPTION 'Student is not eligible to rate this hostel menu'
      USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM "mess_menu_items"
    WHERE "menu_version_id" = NEW."menu_version_id"
      AND "meal_type" = NEW."meal_type"
  ) THEN
    RAISE EXCEPTION 'Selected meal is not present in this menu revision'
      USING ERRCODE = '23514', CONSTRAINT = 'mess_feedback_meal_exists_check';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "mess_feedback_scope_guard"
BEFORE INSERT ON "mess_feedbacks"
FOR EACH ROW EXECUTE FUNCTION validate_mess_feedback_scope();

CREATE OR REPLACE FUNCTION protect_mess_feedback()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Mess feedback is immutable'
    USING ERRCODE = '55000';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "mess_feedback_immutable"
BEFORE UPDATE OR DELETE ON "mess_feedbacks"
FOR EACH ROW EXECUTE FUNCTION protect_mess_feedback();
