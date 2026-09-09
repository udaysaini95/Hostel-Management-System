ALTER TABLE "mess_menus" RENAME TO "legacy_mess_menus";
ALTER SEQUENCE IF EXISTS "mess_menus_id_seq" RENAME TO "legacy_mess_menus_id_seq";

COMMENT ON TABLE "legacy_mess_menus" IS
  'Archived by migration 0016 because timestamp menus had no reliable hostel scope. Reconcile manually before removal.';

DO $$ BEGIN
  CREATE TYPE "mess_meal_type" AS ENUM ('breakfast', 'lunch', 'snacks', 'dinner');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE "mess_menus" (
  "id" serial PRIMARY KEY NOT NULL,
  "hostel_id" integer NOT NULL,
  "menu_date" date NOT NULL,
  "current_version" integer DEFAULT 1 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "mess_menus_version_check" CHECK ("current_version" > 0)
);

CREATE TABLE "mess_menu_versions" (
  "id" serial PRIMARY KEY NOT NULL,
  "menu_id" integer NOT NULL,
  "version" integer NOT NULL,
  "published_by_user_id" integer NOT NULL,
  "published_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "mess_menu_versions_version_check" CHECK ("version" > 0)
);

CREATE TABLE "mess_menu_items" (
  "id" serial PRIMARY KEY NOT NULL,
  "menu_version_id" integer NOT NULL,
  "meal_type" "mess_meal_type" NOT NULL,
  "position" integer NOT NULL,
  "name" varchar(100) NOT NULL,
  CONSTRAINT "mess_menu_items_position_check" CHECK ("position" > 0),
  CONSTRAINT "mess_menu_items_name_check" CHECK (length(trim("name")) between 1 and 100)
);

ALTER TABLE "mess_menus"
  ADD CONSTRAINT "mess_menus_hostel_id_hostels_id_fk"
  FOREIGN KEY ("hostel_id") REFERENCES "public"."hostels"("id")
  ON DELETE restrict ON UPDATE no action;

ALTER TABLE "mess_menu_versions"
  ADD CONSTRAINT "mess_menu_versions_menu_id_mess_menus_id_fk"
  FOREIGN KEY ("menu_id") REFERENCES "public"."mess_menus"("id")
  ON DELETE cascade ON UPDATE no action;

ALTER TABLE "mess_menu_versions"
  ADD CONSTRAINT "mess_menu_versions_published_by_user_id_users_id_fk"
  FOREIGN KEY ("published_by_user_id") REFERENCES "public"."users"("id")
  ON DELETE restrict ON UPDATE no action;

ALTER TABLE "mess_menu_items"
  ADD CONSTRAINT "mess_menu_items_menu_version_id_mess_menu_versions_id_fk"
  FOREIGN KEY ("menu_version_id") REFERENCES "public"."mess_menu_versions"("id")
  ON DELETE cascade ON UPDATE no action;

CREATE UNIQUE INDEX "mess_menus_hostel_date_unique"
  ON "mess_menus" USING btree ("hostel_id", "menu_date");
CREATE INDEX "mess_menus_date_idx"
  ON "mess_menus" USING btree ("menu_date", "hostel_id");
CREATE UNIQUE INDEX "mess_menu_versions_menu_version_unique"
  ON "mess_menu_versions" USING btree ("menu_id", "version");
CREATE INDEX "mess_menu_versions_menu_idx"
  ON "mess_menu_versions" USING btree ("menu_id", "version");
CREATE UNIQUE INDEX "mess_menu_items_position_unique"
  ON "mess_menu_items" USING btree ("menu_version_id", "meal_type", "position");
CREATE INDEX "mess_menu_items_version_idx"
  ON "mess_menu_items" USING btree ("menu_version_id");

CREATE OR REPLACE FUNCTION validate_mess_menu_revision()
RETURNS trigger AS $$
DECLARE
  menu_hostel_id integer;
  menu_current_version integer;
  publisher_role text;
  publisher_status text;
BEGIN
  SELECT "hostel_id", "current_version"
  INTO menu_hostel_id, menu_current_version
  FROM "mess_menus"
  WHERE "id" = NEW."menu_id";

  SELECT "role"::text, "account_status"::text
  INTO publisher_role, publisher_status
  FROM "users"
  WHERE "id" = NEW."published_by_user_id";

  IF NEW."version" IS DISTINCT FROM menu_current_version THEN
    RAISE EXCEPTION 'Menu revision must match the current menu version'
      USING ERRCODE = '23514', CONSTRAINT = 'mess_menu_revision_current_check';
  END IF;

  IF publisher_status IS DISTINCT FROM 'active'
    OR publisher_role NOT IN ('warden', 'admin') THEN
    RAISE EXCEPTION 'Menu publisher is not authorized'
      USING ERRCODE = '42501';
  END IF;

  IF publisher_role = 'warden' AND NOT EXISTS (
    SELECT 1 FROM "hostel_memberships"
    WHERE "user_id" = NEW."published_by_user_id"
      AND "hostel_id" = menu_hostel_id
  ) THEN
    RAISE EXCEPTION 'Warden is outside the menu hostel'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "mess_menu_revision_scope_guard"
BEFORE INSERT ON "mess_menu_versions"
FOR EACH ROW EXECUTE FUNCTION validate_mess_menu_revision();

CREATE OR REPLACE FUNCTION protect_mess_menu_history()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Mess menu history is immutable'
    USING ERRCODE = '55000';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "mess_menu_versions_immutable"
BEFORE UPDATE OR DELETE ON "mess_menu_versions"
FOR EACH ROW EXECUTE FUNCTION protect_mess_menu_history();

CREATE TRIGGER "mess_menu_items_immutable"
BEFORE UPDATE OR DELETE ON "mess_menu_items"
FOR EACH ROW EXECUTE FUNCTION protect_mess_menu_history();

CREATE OR REPLACE FUNCTION protect_mess_menu_identity()
RETURNS trigger AS $$
BEGIN
  IF NEW."hostel_id" IS DISTINCT FROM OLD."hostel_id"
    OR NEW."menu_date" IS DISTINCT FROM OLD."menu_date" THEN
    RAISE EXCEPTION 'Mess menu hostel and date are immutable'
      USING ERRCODE = '55000';
  END IF;

  IF NEW."current_version" IS DISTINCT FROM OLD."current_version" + 1 THEN
    RAISE EXCEPTION 'Mess menu version must advance by one'
      USING ERRCODE = '23514', CONSTRAINT = 'mess_menu_version_sequence_check';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "mess_menu_identity_guard"
BEFORE UPDATE ON "mess_menus"
FOR EACH ROW EXECUTE FUNCTION protect_mess_menu_identity();
