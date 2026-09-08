ALTER TYPE "public"."complaint_event_type" ADD VALUE IF NOT EXISTS 'sla_breached';--> statement-breakpoint

ALTER TABLE "complaints" ADD COLUMN "sla_breached_at" timestamp with time zone;--> statement-breakpoint

ALTER TABLE "complaints" ADD CONSTRAINT "complaints_sla_breached_at_check"
CHECK ("complaints"."sla_breached_at" is null or "complaints"."sla_breached_at" >= "complaints"."sla_deadline");--> statement-breakpoint

CREATE INDEX "complaints_pending_sla_breach_idx"
ON "complaints" USING btree ("sla_deadline")
WHERE "complaints"."status" in ('created', 'assigned', 'in_progress')
  and "complaints"."sla_breached_at" is null;
