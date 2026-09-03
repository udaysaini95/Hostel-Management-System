CREATE TABLE "audit_event_hostels" (
	"id" serial PRIMARY KEY NOT NULL,
	"audit_event_id" integer NOT NULL,
	"hostel_id" integer NOT NULL,
	"hostel_code" varchar(20) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"actor_user_id" integer,
	"actor_name" varchar(255) NOT NULL,
	"actor_email" varchar(255),
	"actor_role" varchar(50) NOT NULL,
	"category" varchar(50) NOT NULL,
	"action" varchar(100) NOT NULL,
	"resource_type" varchar(100) NOT NULL,
	"resource_id" varchar(100) NOT NULL,
	"description" varchar(500) NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"request_id" varchar(100),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "audit_events_action_not_blank_check" CHECK (length(trim("audit_events"."action")) > 0),
	CONSTRAINT "audit_events_resource_not_blank_check" CHECK (length(trim("audit_events"."resource_type")) > 0 and length(trim("audit_events"."resource_id")) > 0),
	CONSTRAINT "audit_events_metadata_object_check" CHECK (jsonb_typeof("audit_events"."metadata") = 'object')
);
--> statement-breakpoint
ALTER TABLE "audit_event_hostels" ADD CONSTRAINT "audit_event_hostels_audit_event_id_audit_events_id_fk" FOREIGN KEY ("audit_event_id") REFERENCES "public"."audit_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "audit_event_hostels_event_hostel_unique" ON "audit_event_hostels" USING btree ("audit_event_id","hostel_id");--> statement-breakpoint
CREATE INDEX "audit_event_hostels_hostel_id_idx" ON "audit_event_hostels" USING btree ("hostel_id");--> statement-breakpoint
CREATE INDEX "audit_events_created_at_idx" ON "audit_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "audit_events_actor_user_id_idx" ON "audit_events" USING btree ("actor_user_id");--> statement-breakpoint
CREATE INDEX "audit_events_action_idx" ON "audit_events" USING btree ("action");--> statement-breakpoint
CREATE INDEX "audit_events_category_created_at_idx" ON "audit_events" USING btree ("category","created_at");--> statement-breakpoint
CREATE INDEX "audit_events_resource_idx" ON "audit_events" USING btree ("resource_type","resource_id");--> statement-breakpoint
CREATE FUNCTION "reject_audit_record_mutation"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
	RAISE EXCEPTION 'Audit records are append-only' USING ERRCODE = '55000';
END;
$$;--> statement-breakpoint
CREATE TRIGGER "audit_events_immutable"
BEFORE UPDATE OR DELETE ON "audit_events"
FOR EACH ROW EXECUTE FUNCTION "reject_audit_record_mutation"();--> statement-breakpoint
CREATE TRIGGER "audit_event_hostels_immutable"
BEFORE UPDATE OR DELETE ON "audit_event_hostels"
FOR EACH ROW EXECUTE FUNCTION "reject_audit_record_mutation"();
