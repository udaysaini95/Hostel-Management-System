import { eq, sql } from "drizzle-orm";
import { hostelMemberships, hostels, users } from "../db/schema.js";
import { ACCOUNT_STATUSES } from "../domain/accountStatuses.js";
import {
  REPORT_DEFINITIONS,
  REPORT_MAX_PERIOD_DAYS,
  REPORT_PERIOD_DAYS,
  REPORT_TYPES,
} from "../domain/reports.js";
import { USER_ROLES } from "../domain/roles.js";
import { ApiError } from "../utils/apiErrors.js";

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

const rowsFrom = (result) => Array.isArray(result) ? result : (result?.rows ?? []);
const numberFrom = (value) => Number(value ?? 0);
const nullableNumberFrom = (value) => value === null || value === undefined
  ? null
  : Number(value);

const paginationFor = (filters, total) => ({
  page: filters.page,
  pageSize: filters.pageSize,
  total,
  totalPages: total === 0 ? 0 : Math.ceil(total / filters.pageSize),
});

export const resolveReportPeriod = (filters = {}, now = new Date()) => {
  const generatedAt = now instanceof Date ? new Date(now) : new Date(now);
  if (Number.isNaN(generatedAt.getTime())) {
    throw new ApiError(400, "INVALID_REPORT_TIME", "Report generation time is invalid");
  }

  const to = filters.to ? new Date(filters.to) : generatedAt;
  const from = filters.from
    ? new Date(filters.from)
    : new Date(to.getTime() - (REPORT_PERIOD_DAYS - 1) * MILLISECONDS_PER_DAY);

  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    throw new ApiError(422, "INVALID_REPORT_PERIOD", "Report period is invalid");
  }
  if (to < from) {
    throw new ApiError(422, "INVALID_REPORT_PERIOD", "Report end time cannot be before start time");
  }
  if ((to.getTime() - from.getTime()) / MILLISECONDS_PER_DAY > REPORT_MAX_PERIOD_DAYS) {
    throw new ApiError(
      422,
      "REPORT_PERIOD_TOO_LARGE",
      `Report period cannot exceed ${REPORT_MAX_PERIOD_DAYS} days`
    );
  }
  if (to > generatedAt) {
    throw new ApiError(422, "REPORT_PERIOD_IN_FUTURE", "Report end time cannot be in the future");
  }

  return Object.freeze({
    from,
    to,
    generatedAt,
    response: Object.freeze({
      from: from.toISOString(),
      to: to.toISOString(),
      timezone: "UTC",
      boundaries: "inclusive",
    }),
  });
};

const loadReportActor = async (database, requestActor) => {
  const actorId = Number(requestActor?.id);
  if (!Number.isSafeInteger(actorId) || actorId < 1) {
    throw new ApiError(401, "AUTHENTICATION_REQUIRED", "Authentication is required");
  }

  const [actor] = await database
    .select({ id: users.id, role: users.role, accountStatus: users.accountStatus })
    .from(users)
    .where(eq(users.id, actorId))
    .limit(1);

  if (
    !actor ||
    actor.accountStatus !== ACCOUNT_STATUSES.ACTIVE ||
    actor.role !== requestActor.role ||
    ![USER_ROLES.ADMIN, USER_ROLES.WARDEN].includes(actor.role)
  ) {
    throw new ApiError(403, "REPORT_ACCESS_DENIED", "Operational reports require an active administrator or warden account");
  }

  return actor;
};

const loadReportScope = async (database, actor, requestedHostelId) => {
  const membershipRows = actor.role === USER_ROLES.WARDEN
    ? await database
        .select({ hostelId: hostelMemberships.hostelId })
        .from(hostelMemberships)
        .where(eq(hostelMemberships.userId, actor.id))
    : [];
  const assignedHostelIds = membershipRows.map(({ hostelId }) => hostelId);

  if (requestedHostelId) {
    if (
      actor.role === USER_ROLES.WARDEN &&
      !assignedHostelIds.includes(requestedHostelId)
    ) {
      throw new ApiError(403, "REPORT_HOSTEL_ACCESS_DENIED", "You cannot report on this hostel");
    }

    const [hostel] = await database
      .select({ id: hostels.id, code: hostels.code, name: hostels.name })
      .from(hostels)
      .where(eq(hostels.id, requestedHostelId))
      .limit(1);
    if (!hostel) {
      throw new ApiError(404, "HOSTEL_NOT_FOUND", "Hostel was not found");
    }

    return Object.freeze({
      kind: "selected_hostel",
      hostelIds: Object.freeze([requestedHostelId]),
      hostel,
    });
  }

  return Object.freeze({
    kind: actor.role === USER_ROLES.ADMIN ? "institution" : "assigned_hostels",
    hostelIds: Object.freeze(assignedHostelIds),
    hostel: null,
  });
};

const hostelCondition = (actor, scope, tableAlias) => {
  if (scope.hostel) {
    return sql`${sql.identifier(tableAlias)}.hostel_id = ${scope.hostel.id}`;
  }
  if (actor.role === USER_ROLES.ADMIN) return sql`true`;

  return sql`${sql.identifier(tableAlias)}.hostel_id in (
    select membership.hostel_id
    from hostel_memberships membership
    where membership.user_id = ${actor.id}
  )`;
};

const reportEnvelope = ({
  type,
  period,
  scope,
  filters,
  appliedFilters,
  summary,
  data,
  total,
}) => ({
  report: type,
  generatedAt: period.generatedAt.toISOString(),
  period: period.response,
  scope: {
    kind: scope.kind,
    hostelIds: scope.hostelIds,
    hostel: scope.hostel,
  },
  definitions: REPORT_DEFINITIONS[type],
  filters: appliedFilters,
  summary,
  data,
  pagination: paginationFor(filters, total),
});

const getComplaintReport = async (database, context) => {
  const { actor, filters, period, scope } = context;
  const scopeCondition = hostelCondition(actor, scope, "complaint");
  const conditions = sql`
    complaint.created_at >= ${period.from}
    and complaint.created_at <= ${period.to}
    and ${scopeCondition}
    ${filters.status ? sql`and complaint.status = ${filters.status}` : sql``}
    ${filters.priority ? sql`and complaint.priority = ${filters.priority}` : sql``}
  `;
  const summaryResult = await database.execute(sql`
    with selected as (
      select complaint.id, complaint.status, complaint.sla_deadline, complaint.created_at,
             first_resolution.occurred_at as first_resolved_at,
             coalesce(reopen.reopened_count, 0) as reopened_count
      from complaints complaint
      left join lateral (
        select min(event.occurred_at) as occurred_at
        from complaint_events event
        where event.complaint_id = complaint.id and event.event_type = 'resolved'
      ) first_resolution on true
      left join lateral (
        select count(*)::integer as reopened_count
        from complaint_events event
        where event.complaint_id = complaint.id and event.event_type = 'reopened'
      ) reopen on true
      where ${conditions}
    )
    select
      count(*)::integer as total,
      count(*) filter (where status <> 'closed')::integer as open_count,
      count(*) filter (
        where status <> 'closed' and sla_deadline < ${period.generatedAt}
      )::integer as current_sla_breaches,
      count(*) filter (where first_resolved_at is not null)::integer as first_resolved_count,
      count(*) filter (
        where first_resolved_at is not null and first_resolved_at <= sla_deadline
      )::integer as resolved_within_sla,
      round(
        100.0 * count(*) filter (
          where first_resolved_at is not null and first_resolved_at <= sla_deadline
        ) / nullif(count(*) filter (where first_resolved_at is not null), 0),
        1
      )::float as resolution_compliance_percent,
      round((avg(extract(epoch from (first_resolved_at - created_at)) / 3600.0)
        filter (where first_resolved_at is not null))::numeric, 2)::float
        as average_first_resolution_hours,
      coalesce(sum(reopened_count), 0)::integer as reopened_events
    from selected
  `);
  const [summaryRow = {}] = rowsFrom(summaryResult);
  const dataResult = await database.execute(sql`
    select complaint.id, complaint.status, complaint.priority, complaint.location,
           complaint.created_at, complaint.sla_deadline, hostel.code as hostel_code,
           category.code as category_code, category.name as category_name,
           reporter.name as student_name, profile.roll_no,
           first_resolution.occurred_at as first_resolved_at,
           case when first_resolution.occurred_at is null then null
             else round((extract(epoch from (first_resolution.occurred_at - complaint.created_at)) / 3600.0)::numeric, 2)::float
           end as first_resolution_hours,
           coalesce(reopen.reopened_count, 0)::integer as reopened_count
    from complaints complaint
    inner join hostels hostel on hostel.id = complaint.hostel_id
    inner join complaint_categories category on category.id = complaint.category_id
    inner join users reporter on reporter.id = complaint.reported_by_user_id
    left join student_profiles profile on profile.id = complaint.student_profile_id
    left join lateral (
      select min(event.occurred_at) as occurred_at
      from complaint_events event
      where event.complaint_id = complaint.id and event.event_type = 'resolved'
    ) first_resolution on true
    left join lateral (
      select count(*)::integer as reopened_count
      from complaint_events event
      where event.complaint_id = complaint.id and event.event_type = 'reopened'
    ) reopen on true
    where ${conditions}
    order by complaint.created_at desc, complaint.id desc
    limit ${filters.pageSize} offset ${(filters.page - 1) * filters.pageSize}
  `);
  const total = numberFrom(summaryRow.total);

  return reportEnvelope({
    ...context,
    type: REPORT_TYPES.COMPLAINTS,
    total,
    summary: {
      total,
      open: numberFrom(summaryRow.open_count),
      currentSlaBreaches: numberFrom(summaryRow.current_sla_breaches),
      firstResolvedComplaints: numberFrom(summaryRow.first_resolved_count),
      resolvedWithinSla: numberFrom(summaryRow.resolved_within_sla),
      resolutionCompliancePercent: nullableNumberFrom(summaryRow.resolution_compliance_percent),
      averageFirstResolutionHours: nullableNumberFrom(summaryRow.average_first_resolution_hours),
      reopenedEvents: numberFrom(summaryRow.reopened_events),
    },
    data: rowsFrom(dataResult).map((row) => ({
      id: row.id,
      hostelCode: row.hostel_code,
      student: { name: row.student_name, rollNo: row.roll_no },
      category: { code: row.category_code, name: row.category_name },
      location: row.location,
      status: row.status,
      priority: row.priority,
      createdAt: row.created_at,
      slaDeadline: row.sla_deadline,
      currentSlaBreached: row.status !== "closed" && new Date(row.sla_deadline) < period.generatedAt,
      firstResolvedAt: row.first_resolved_at,
      firstResolutionHours: nullableNumberFrom(row.first_resolution_hours),
      reopenedCount: numberFrom(row.reopened_count),
    })),
  });
};

const getLeaveReport = async (database, context) => {
  const { actor, filters, period, scope } = context;
  const scopeCondition = hostelCondition(actor, scope, "leave_request");
  const conditions = sql`
    leave_request.created_at >= ${period.from}
    and leave_request.created_at <= ${period.to}
    and ${scopeCondition}
    ${filters.status ? sql`and leave_request.status = ${filters.status}` : sql``}
    ${filters.emergency !== undefined ? sql`and leave_request.is_emergency = ${filters.emergency}` : sql``}
  `;
  const summaryResult = await database.execute(sql`
    select count(*)::integer as total,
      count(*) filter (where leave_request.status = 'pending')::integer as pending_count,
      count(*) filter (where leave_request.status = 'approved')::integer as approved_count,
      count(*) filter (where leave_request.status = 'rejected')::integer as rejected_count,
      count(*) filter (where leave_request.status = 'exited')::integer as exited_count,
      count(*) filter (where leave_request.status = 'returned')::integer as returned_count,
      count(*) filter (where leave_request.status = 'expired')::integer as expired_count,
      count(*) filter (where leave_request.is_emergency)::integer as emergency_count,
      round(avg(extract(epoch from (leave_request.expected_return_at - leave_request.departure_at)) / 3600.0)::numeric, 2)::float
        as average_requested_hours
    from leave_requests leave_request
    where ${conditions}
  `);
  const [summaryRow = {}] = rowsFrom(summaryResult);
  const dataResult = await database.execute(sql`
    select leave_request.id, leave_request.status, leave_request.reason,
           leave_request.is_emergency, leave_request.created_at,
           leave_request.departure_at, leave_request.expected_return_at,
           hostel.code as hostel_code, student.name as student_name, profile.roll_no
    from leave_requests leave_request
    inner join hostels hostel on hostel.id = leave_request.hostel_id
    inner join users student on student.id = leave_request.student_user_id
    inner join student_profiles profile on profile.id = leave_request.student_profile_id
    where ${conditions}
    order by leave_request.created_at desc, leave_request.id desc
    limit ${filters.pageSize} offset ${(filters.page - 1) * filters.pageSize}
  `);
  const total = numberFrom(summaryRow.total);

  return reportEnvelope({
    ...context,
    type: REPORT_TYPES.LEAVES,
    total,
    summary: {
      total,
      byStatus: {
        pending: numberFrom(summaryRow.pending_count),
        approved: numberFrom(summaryRow.approved_count),
        rejected: numberFrom(summaryRow.rejected_count),
        exited: numberFrom(summaryRow.exited_count),
        returned: numberFrom(summaryRow.returned_count),
        expired: numberFrom(summaryRow.expired_count),
      },
      emergency: numberFrom(summaryRow.emergency_count),
      averageRequestedHours: nullableNumberFrom(summaryRow.average_requested_hours),
    },
    data: rowsFrom(dataResult).map((row) => ({
      id: row.id,
      hostelCode: row.hostel_code,
      student: { name: row.student_name, rollNo: row.roll_no },
      reason: row.reason,
      status: row.status,
      emergency: row.is_emergency,
      submittedAt: row.created_at,
      departureAt: row.departure_at,
      expectedReturnAt: row.expected_return_at,
    })),
  });
};

const getGateReport = async (database, context) => {
  const { actor, filters, period, scope } = context;
  const scopeCondition = hostelCondition(actor, scope, "leave_request");
  const conditions = sql`
    gate_event.occurred_at >= ${period.from}
    and gate_event.occurred_at <= ${period.to}
    and ${scopeCondition}
    ${filters.movement ? sql`and gate_event.movement = ${filters.movement}` : sql``}
  `;
  const summaryResult = await database.execute(sql`
    select count(*)::integer as total,
      count(*) filter (where gate_event.movement = 'exit')::integer as exits,
      count(*) filter (where gate_event.movement = 'return')::integer as returns,
      count(*) filter (where gate_event.verification_method = 'override')::integer as overrides,
      count(distinct leave_request.student_user_id)::integer as unique_students
    from gate_events gate_event
    inner join leave_requests leave_request on leave_request.id = gate_event.leave_request_id
    where ${conditions}
  `);
  const [summaryRow = {}] = rowsFrom(summaryResult);
  const dataResult = await database.execute(sql`
    select gate_event.id, gate_event.movement, gate_event.verification_method,
           gate_event.actor_name, gate_event.note, gate_event.occurred_at,
           hostel.code as hostel_code, student.name as student_name, profile.roll_no
    from gate_events gate_event
    inner join leave_requests leave_request on leave_request.id = gate_event.leave_request_id
    inner join hostels hostel on hostel.id = leave_request.hostel_id
    inner join users student on student.id = leave_request.student_user_id
    inner join student_profiles profile on profile.id = leave_request.student_profile_id
    where ${conditions}
    order by gate_event.occurred_at desc, gate_event.id desc
    limit ${filters.pageSize} offset ${(filters.page - 1) * filters.pageSize}
  `);
  const total = numberFrom(summaryRow.total);

  return reportEnvelope({
    ...context,
    type: REPORT_TYPES.GATE,
    total,
    summary: {
      total,
      exits: numberFrom(summaryRow.exits),
      returns: numberFrom(summaryRow.returns),
      overrides: numberFrom(summaryRow.overrides),
      uniqueStudents: numberFrom(summaryRow.unique_students),
    },
    data: rowsFrom(dataResult).map((row) => ({
      id: row.id,
      hostelCode: row.hostel_code,
      student: { name: row.student_name, rollNo: row.roll_no },
      movement: row.movement,
      verificationMethod: row.verification_method,
      performedBy: row.actor_name,
      note: row.note,
      occurredAt: row.occurred_at,
    })),
  });
};

const mealSummary = (row, mealType) => ({
  average: nullableNumberFrom(row[`${mealType}_average`]),
  responses: numberFrom(row[`${mealType}_responses`]),
});

const getMessReport = async (database, context) => {
  const { actor, filters, period, scope } = context;
  const scopeCondition = hostelCondition(actor, scope, "menu");
  const fromDate = period.response.from.slice(0, 10);
  const toDate = period.response.to.slice(0, 10);
  const conditions = sql`
    menu.menu_date >= ${fromDate}
    and menu.menu_date <= ${toDate}
    and ${scopeCondition}
    ${filters.mealType ? sql`and feedback.meal_type = ${filters.mealType}` : sql``}
  `;
  const summaryResult = await database.execute(sql`
    select count(*)::integer as responses,
      count(distinct (menu.menu_date, menu.hostel_id, feedback.meal_type))::integer as group_count,
      round(avg(feedback.rating)::numeric, 2)::float as average_rating,
      round((avg(feedback.rating) filter (where feedback.meal_type = 'breakfast'))::numeric, 2)::float as breakfast_average,
      count(*) filter (where feedback.meal_type = 'breakfast')::integer as breakfast_responses,
      round((avg(feedback.rating) filter (where feedback.meal_type = 'lunch'))::numeric, 2)::float as lunch_average,
      count(*) filter (where feedback.meal_type = 'lunch')::integer as lunch_responses,
      round((avg(feedback.rating) filter (where feedback.meal_type = 'snacks'))::numeric, 2)::float as snacks_average,
      count(*) filter (where feedback.meal_type = 'snacks')::integer as snacks_responses,
      round((avg(feedback.rating) filter (where feedback.meal_type = 'dinner'))::numeric, 2)::float as dinner_average,
      count(*) filter (where feedback.meal_type = 'dinner')::integer as dinner_responses
    from mess_feedbacks feedback
    inner join mess_menus menu on menu.id = feedback.menu_id
    where ${conditions}
  `);
  const [summaryRow = {}] = rowsFrom(summaryResult);
  const dataResult = await database.execute(sql`
    select menu.menu_date, hostel.code as hostel_code, feedback.meal_type,
           count(*)::integer as responses,
           round(avg(feedback.rating)::numeric, 2)::float as average_rating
    from mess_feedbacks feedback
    inner join mess_menus menu on menu.id = feedback.menu_id
    inner join hostels hostel on hostel.id = menu.hostel_id
    where ${conditions}
    group by menu.menu_date, hostel.id, feedback.meal_type
    order by menu.menu_date desc, hostel.code, feedback.meal_type
    limit ${filters.pageSize} offset ${(filters.page - 1) * filters.pageSize}
  `);
  const total = numberFrom(summaryRow.group_count);

  return reportEnvelope({
    ...context,
    type: REPORT_TYPES.MESS,
    total,
    summary: {
      responses: numberFrom(summaryRow.responses),
      averageRating: nullableNumberFrom(summaryRow.average_rating),
      byMeal: {
        breakfast: mealSummary(summaryRow, "breakfast"),
        lunch: mealSummary(summaryRow, "lunch"),
        snacks: mealSummary(summaryRow, "snacks"),
        dinner: mealSummary(summaryRow, "dinner"),
      },
    },
    data: rowsFrom(dataResult).map((row) => ({
      date: row.menu_date,
      hostelCode: row.hostel_code,
      mealType: row.meal_type,
      responses: numberFrom(row.responses),
      averageRating: nullableNumberFrom(row.average_rating),
    })),
  });
};

const reportLoaders = Object.freeze({
  [REPORT_TYPES.COMPLAINTS]: getComplaintReport,
  [REPORT_TYPES.LEAVES]: getLeaveReport,
  [REPORT_TYPES.GATE]: getGateReport,
  [REPORT_TYPES.MESS]: getMessReport,
});

export const getOperationalReport = async (
  database,
  requestActor,
  type,
  filters,
  { now = new Date() } = {}
) => {
  const loader = reportLoaders[type];
  if (!loader) {
    throw new ApiError(404, "REPORT_NOT_FOUND", "Report type was not found");
  }

  const actor = await loadReportActor(database, requestActor);
  const period = resolveReportPeriod(filters, now);
  const scope = await loadReportScope(database, actor, filters.hostelId);
  const appliedFilters = Object.fromEntries(
    Object.entries(filters).filter(
      ([key, value]) =>
        !["page", "pageSize", "from", "to"].includes(key) && value !== undefined
    )
  );

  return loader(database, {
    actor,
    filters,
    appliedFilters,
    period,
    scope,
  });
};
