import {
  and,
  asc,
  eq,
  inArray,
  isNull,
  lt,
  sql,
} from "drizzle-orm";
import {
  complaintEvents,
  complaints,
  hostels,
} from "../db/schema.js";
import {
  AUDIT_ACTIONS,
  AUDIT_CATEGORIES,
  AUDIT_RESOURCE_TYPES,
} from "../domain/auditEvents.js";
import {
  COMPLAINT_EVENT_TYPES,
  COMPLAINT_STATUSES,
} from "../domain/complaintWorkflow.js";
import { USER_ROLES } from "../domain/roles.js";
import { ApiError } from "../utils/apiErrors.js";
import { appendSlaMonitorAuditEvent } from "./auditEventService.js";
import { loadComplaintActor } from "./complaintService.js";

const metricRoles = new Set([
  USER_ROLES.ADMIN,
  USER_ROLES.WARDEN,
  USER_ROLES.MAINTENANCE,
]);
const actionableStatuses = Object.freeze([
  COMPLAINT_STATUSES.CREATED,
  COMPLAINT_STATUSES.ASSIGNED,
  COMPLAINT_STATUSES.IN_PROGRESS,
]);
const monitorActor = Object.freeze({
  name: "HostelMate SLA monitor",
  role: "system",
});

const requireOperationTime = (value) => {
  const time = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(time.getTime())) {
    throw new ApiError(
      400,
      "INVALID_SLA_MONITOR_TIME",
      "The SLA operation time is invalid"
    );
  }

  return time;
};

const normalizeHostelCode = (value) => {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const code = typeof value === "string" ? value.trim().toUpperCase() : "";

  if (!/^[A-Z][A-Z0-9-]{0,19}$/.test(code)) {
    throw new ApiError(400, "INVALID_HOSTEL", "Hostel code is invalid");
  }

  return code;
};

const toNumber = (value) => Number(value ?? 0);

const roundOneDecimal = (value) => {
  if (value === null || value === undefined) {
    return null;
  }

  return Math.round(Number(value) * 10) / 10;
};

export const formatComplaintSlaMetrics = (
  record,
  { actorRole, hostelCode = null, generatedAt }
) => {
  const firstResolvedComplaints = toNumber(record.first_resolved_count);
  const withinSla = toNumber(record.within_sla_count);

  return Object.freeze({
    generatedAt: generatedAt.toISOString(),
    scope: Object.freeze({
      kind:
        actorRole === USER_ROLES.ADMIN
          ? "institution"
          : actorRole === USER_ROLES.WARDEN
            ? "managed_hostels"
            : "active_assignments",
      hostelCode,
    }),
    counts: Object.freeze({
      open: toNumber(record.open_count),
      actionable: toNumber(record.actionable_count),
      awaitingStudentConfirmation: toNumber(record.awaiting_confirmation_count),
      slaBreached: toNumber(record.sla_breached_count),
      recordedBreaches: toNumber(record.recorded_breach_count),
      unassigned: toNumber(record.unassigned_count),
      byPriority: Object.freeze({
        critical: toNumber(record.critical_count),
        high: toNumber(record.high_count),
        medium: toNumber(record.medium_count),
        low: toNumber(record.low_count),
      }),
    }),
    resolution: Object.freeze({
      firstResolvedComplaints,
      withinSla,
      afterSla: toNumber(record.after_sla_count),
      compliancePercent:
        firstResolvedComplaints === 0
          ? null
          : roundOneDecimal((withinSla / firstResolvedComplaints) * 100),
      averageFirstResolutionMinutes: roundOneDecimal(
        record.average_first_resolution_minutes
      ),
      reopenedComplaints: toNumber(record.reopened_complaint_count),
      reopenEvents: toNumber(record.reopen_event_count),
    }),
  });
};

const buildMetricScope = (actor, hostelCode) => {
  const conditions = [];

  if (actor.role === USER_ROLES.WARDEN) {
    conditions.push(sql`exists (
      select 1
      from hostel_memberships membership
      where membership.hostel_id = complaint.hostel_id
        and membership.user_id = ${actor.id}
    )`);
  }

  if (actor.role === USER_ROLES.MAINTENANCE) {
    conditions.push(sql`exists (
      select 1
      from complaint_assignments assignment
      where assignment.complaint_id = complaint.id
        and assignment.assignee_user_id = ${actor.id}
        and assignment.ended_at is null
    )`);
  }

  if (hostelCode) {
    conditions.push(sql`exists (
      select 1
      from hostels hostel
      where hostel.id = complaint.hostel_id
        and hostel.code = ${hostelCode}
    )`);
  }

  return conditions.length === 0
    ? sql`true`
    : sql.join(conditions, sql` and `);
};

const getRows = (queryResult) =>
  Array.isArray(queryResult) ? queryResult : (queryResult?.rows ?? []);

export const getComplaintSlaMetrics = async (
  database,
  requestActor,
  input = {},
  { now = new Date() } = {}
) => {
  const generatedAt = requireOperationTime(now);
  const hostelCode = normalizeHostelCode(input.hostelCode);
  const actor = await loadComplaintActor(database, requestActor);

  if (!metricRoles.has(actor.role)) {
    throw new ApiError(
      403,
      "COMPLAINT_METRICS_DENIED",
      "You cannot view complaint SLA metrics"
    );
  }

  const scope = buildMetricScope(actor, hostelCode);
  const result = await database.execute(sql`
    with scoped_complaints as (
      select complaint.*
      from complaints complaint
      where ${scope}
    ),
    first_resolutions as (
      select event.complaint_id, min(event.occurred_at) as resolved_at
      from complaint_events event
      inner join scoped_complaints complaint on complaint.id = event.complaint_id
      where event.event_type = 'resolved'
      group by event.complaint_id
    ),
    reopen_stats as (
      select
        count(*)::integer as reopen_event_count,
        count(distinct event.complaint_id)::integer as reopened_complaint_count
      from complaint_events event
      inner join scoped_complaints complaint on complaint.id = event.complaint_id
      where event.event_type = 'reopened'
    )
    select
      count(*) filter (where complaint.status <> 'closed')::integer as open_count,
      count(*) filter (
        where complaint.status in ('created', 'assigned', 'in_progress')
      )::integer as actionable_count,
      count(*) filter (where complaint.status = 'resolved')::integer
        as awaiting_confirmation_count,
      count(*) filter (
        where complaint.status <> 'closed'
          and complaint.sla_deadline < ${generatedAt}
      )::integer as sla_breached_count,
      count(*) filter (where complaint.sla_breached_at is not null)::integer
        as recorded_breach_count,
      count(*) filter (where complaint.status = 'created')::integer
        as unassigned_count,
      count(*) filter (
        where complaint.status in ('created', 'assigned', 'in_progress')
          and complaint.priority = 'critical'
      )::integer as critical_count,
      count(*) filter (
        where complaint.status in ('created', 'assigned', 'in_progress')
          and complaint.priority = 'high'
      )::integer as high_count,
      count(*) filter (
        where complaint.status in ('created', 'assigned', 'in_progress')
          and complaint.priority = 'medium'
      )::integer as medium_count,
      count(*) filter (
        where complaint.status in ('created', 'assigned', 'in_progress')
          and complaint.priority = 'low'
      )::integer as low_count,
      count(first_resolution.complaint_id)::integer as first_resolved_count,
      count(first_resolution.complaint_id) filter (
        where first_resolution.resolved_at <= complaint.sla_deadline
      )::integer as within_sla_count,
      count(first_resolution.complaint_id) filter (
        where first_resolution.resolved_at > complaint.sla_deadline
      )::integer as after_sla_count,
      avg(
        extract(epoch from (first_resolution.resolved_at - complaint.created_at)) / 60
      ) as average_first_resolution_minutes,
      reopen_stats.reopened_complaint_count,
      reopen_stats.reopen_event_count
    from scoped_complaints complaint
    left join first_resolutions first_resolution
      on first_resolution.complaint_id = complaint.id
    cross join reopen_stats
    group by reopen_stats.reopened_complaint_count, reopen_stats.reopen_event_count
  `);
  const [record] = getRows(result);

  return formatComplaintSlaMetrics(record ?? {}, {
    actorRole: actor.role,
    hostelCode,
    generatedAt,
  });
};

const requireBatchSize = (value) => {
  const batchSize = Number(value);

  if (!Number.isSafeInteger(batchSize) || batchSize < 1 || batchSize > 500) {
    throw new ApiError(
      400,
      "INVALID_SLA_MONITOR_BATCH",
      "SLA monitor batch size must be between 1 and 500"
    );
  }

  return batchSize;
};

export const monitorComplaintSlaBreaches = async (
  database,
  { now = new Date(), batchSize = 100 } = {}
) => {
  const breachedAt = requireOperationTime(now);
  const limit = requireBatchSize(batchSize);

  return database.transaction(async (transaction) => {
    const candidates = await transaction
      .select({
        id: complaints.id,
        hostelId: complaints.hostelId,
        hostelCode: hostels.code,
        status: complaints.status,
        slaDeadline: complaints.slaDeadline,
      })
      .from(complaints)
      .innerJoin(hostels, eq(complaints.hostelId, hostels.id))
      .where(
        and(
          inArray(complaints.status, actionableStatuses),
          isNull(complaints.slaBreachedAt),
          lt(complaints.slaDeadline, breachedAt)
        )
      )
      .orderBy(asc(complaints.slaDeadline), asc(complaints.id))
      .limit(limit);

    const breaches = [];

    for (const candidate of candidates) {
      const [updated] = await transaction
        .update(complaints)
        .set({
          slaBreachedAt: breachedAt,
          updatedAt: sql`greatest(${complaints.updatedAt}, ${breachedAt})`,
        })
        .where(
          and(
            eq(complaints.id, candidate.id),
            inArray(complaints.status, actionableStatuses),
            isNull(complaints.slaBreachedAt),
            lt(complaints.slaDeadline, breachedAt)
          )
        )
        .returning({ id: complaints.id });

      // Another worker may have claimed the same candidate after our select.
      // The guarded update makes the operation safe to retry and run in parallel.
      if (!updated) {
        continue;
      }

      const deadline = new Date(candidate.slaDeadline);
      const overdueSeconds = Math.max(
        0,
        Math.floor((breachedAt.getTime() - deadline.getTime()) / 1000)
      );
      const metadata = {
        slaDeadline: deadline.toISOString(),
        breachedAt: breachedAt.toISOString(),
        overdueSeconds,
      };

      await transaction.insert(complaintEvents).values({
        complaintId: candidate.id,
        eventType: COMPLAINT_EVENT_TYPES.SLA_BREACHED,
        fromStatus: candidate.status,
        toStatus: candidate.status,
        actorUserId: null,
        actorName: monitorActor.name,
        actorRole: monitorActor.role,
        note: "SLA deadline breached; management review is required.",
        metadata,
        occurredAt: breachedAt,
      });

      await appendSlaMonitorAuditEvent(transaction, {
        category: AUDIT_CATEGORIES.COMPLAINT,
        action: AUDIT_ACTIONS.COMPLAINT_SLA_BREACHED,
        resourceType: AUDIT_RESOURCE_TYPES.COMPLAINT,
        resourceId: candidate.id,
        description: `Complaint ${candidate.id} breached its SLA deadline`,
        metadata: { status: candidate.status, ...metadata },
        assignedHostels: [
          { id: candidate.hostelId, code: candidate.hostelCode },
        ],
        createdAt: breachedAt,
      });

      breaches.push(
        Object.freeze({
          complaintId: candidate.id,
          hostelCode: candidate.hostelCode,
          status: candidate.status,
          slaDeadline: deadline.toISOString(),
          breachedAt: breachedAt.toISOString(),
          overdueSeconds,
        })
      );
    }

    return Object.freeze({ processed: breaches.length, breaches });
  });
};
