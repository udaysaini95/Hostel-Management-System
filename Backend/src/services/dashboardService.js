import { eq, sql } from "drizzle-orm";
import {
  hostelMemberships,
  studentProfiles,
  users,
} from "../db/schema.js";
import { ACCOUNT_STATUSES } from "../domain/accountStatuses.js";
import {
  DASHBOARD_DEFINITIONS,
  DASHBOARD_LINKS,
  DASHBOARD_PERIOD_DAYS,
} from "../domain/dashboardMetrics.js";
import { USER_ROLES } from "../domain/roles.js";
import { ApiError } from "../utils/apiErrors.js";

const fail = (status, code, message) => {
  throw new ApiError(status, code, message);
};

const rowsFrom = (result) => Array.isArray(result) ? result : (result?.rows ?? []);
const countOf = (value) => Number(value ?? 0);
const averageOf = (value) => value === null || value === undefined
  ? null
  : Number(Number(value).toFixed(1));

const metric = (value, definition, href, extra = {}) => Object.freeze({
  value,
  definition,
  href,
  ...extra,
});

const validNow = (value) => {
  const now = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(now.getTime())) {
    fail(400, "INVALID_DASHBOARD_TIME", "Dashboard generation time is invalid");
  }
  return now;
};

const calendarDate = (date) => date.toISOString().slice(0, 10);

const dashboardPeriod = (now) => {
  const from = new Date(now);
  from.setUTCDate(from.getUTCDate() - (DASHBOARD_PERIOD_DAYS - 1));
  return Object.freeze({ from: calendarDate(from), to: calendarDate(now) });
};

const loadActor = async (database, requestActor) => {
  const actorId = Number(requestActor?.id);
  if (!Number.isSafeInteger(actorId) || actorId < 1) {
    fail(401, "AUTHENTICATION_REQUIRED", "Authentication is required");
  }

  const [actor] = await database
    .select({
      id: users.id,
      name: users.name,
      role: users.role,
      accountStatus: users.accountStatus,
    })
    .from(users)
    .where(eq(users.id, actorId))
    .limit(1);

  if (
    !actor ||
    actor.accountStatus !== ACCOUNT_STATUSES.ACTIVE ||
    actor.role !== requestActor.role
  ) {
    fail(403, "DASHBOARD_ACCESS_DENIED", "An active matching account is required");
  }
  return actor;
};

const loadAssignedHostelIds = async (database, actorId) => {
  const memberships = await database
    .select({ hostelId: hostelMemberships.hostelId })
    .from(hostelMemberships)
    .where(eq(hostelMemberships.userId, actorId));
  return memberships.map(({ hostelId }) => hostelId);
};

const getStudentDashboard = async (database, actor, now, period) => {
  const [profile] = await database
    .select({ hostelId: studentProfiles.hostelId })
    .from(studentProfiles)
    .where(eq(studentProfiles.userId, actor.id))
    .limit(1);
  if (!profile) fail(409, "STUDENT_PROFILE_REQUIRED", "Complete the student profile to view the dashboard");

  const result = await database.execute(sql`
    select
      (select count(*)::integer
       from complaints complaint
       where complaint.reported_by_user_id = ${actor.id}
         and complaint.status <> 'closed') as active_complaints,
      (select count(*)::integer
       from notice_recipients recipient
       inner join notices notice on notice.id = recipient.notice_id
       where recipient.user_id = ${actor.id}
         and recipient.read_at is null
         and notice.published_at <= ${now}
         and (notice.expires_at is null or notice.expires_at > ${now})) as unread_notices
  `);
  const [record = {}] = rowsFrom(result);

  const leaveResult = await database.execute(sql`
    select
      leave_request.id,
      leave_request.status,
      leave_request.departure_at,
      leave_request.expected_return_at,
      gate_pass.id as gate_pass_id,
      gate_pass.valid_from,
      gate_pass.expires_at,
      gate_pass.revoked_at
    from leave_requests leave_request
    left join gate_passes gate_pass on gate_pass.leave_request_id = leave_request.id
    where leave_request.student_user_id = ${actor.id}
    order by leave_request.created_at desc, leave_request.id desc
    limit 1
  `);
  const [latestLeave = null] = rowsFrom(leaveResult);

  const menuResult = await database.execute(sql`
    select
      menu.id,
      menu.menu_date,
      menu.current_version,
      coalesce(
        jsonb_agg(
          jsonb_build_object(
            'mealType', item.meal_type,
            'name', item.name,
            'position', item.position
          ) order by item.meal_type, item.position
        ) filter (where item.id is not null),
        '[]'::jsonb
      ) as items
    from mess_menus menu
    inner join mess_menu_versions version
      on version.menu_id = menu.id and version.version = menu.current_version
    left join mess_menu_items item on item.menu_version_id = version.id
    where menu.hostel_id = ${profile.hostelId}
      and menu.menu_date = ${period.to}
    group by menu.id
    limit 1
  `);
  const [todayMenu = null] = rowsFrom(menuResult);

  return Object.freeze({
    activeComplaints: metric(
      countOf(record.active_complaints),
      DASHBOARD_DEFINITIONS.OPEN_COMPLAINTS,
      DASHBOARD_LINKS.STUDENT_COMPLAINTS
    ),
    latestLeave: Object.freeze({
      value: latestLeave ? {
        id: latestLeave.id,
        status: latestLeave.status,
        departureAt: latestLeave.departure_at,
        expectedReturnAt: latestLeave.expected_return_at,
        gatePass: latestLeave.gate_pass_id ? {
          id: latestLeave.gate_pass_id,
          validFrom: latestLeave.valid_from,
          expiresAt: latestLeave.expires_at,
          revokedAt: latestLeave.revoked_at,
        } : null,
      } : null,
      definition: "Most recently submitted leave request and its issued gate pass.",
      href: DASHBOARD_LINKS.STUDENT_LEAVES,
    }),
    todayMenu: Object.freeze({
      value: todayMenu ? {
        id: todayMenu.id,
        date: todayMenu.menu_date,
        version: todayMenu.current_version,
        items: todayMenu.items,
      } : null,
      definition: "Current published menu revision for the student's hostel today.",
      href: DASHBOARD_LINKS.STUDENT_MESS,
    }),
    unreadNotices: metric(
      countOf(record.unread_notices),
      "Active received notices without a read timestamp.",
      DASHBOARD_LINKS.NOTICES
    ),
  });
};

const getOperationsDashboard = async (database, actor, now, period) => {
  const institutionWide = actor.role === USER_ROLES.ADMIN;
  const leaveScope = institutionWide
    ? sql`true`
    : sql`leave_request.hostel_id in (
        select membership.hostel_id from hostel_memberships membership
        where membership.user_id = ${actor.id}
      )`;
  const complaintScope = institutionWide
    ? sql`true`
    : sql`complaint.hostel_id in (
        select membership.hostel_id from hostel_memberships membership
        where membership.user_id = ${actor.id}
      )`;
  const menuScope = institutionWide
    ? sql`true`
    : sql`menu.hostel_id in (
        select membership.hostel_id from hostel_memberships membership
        where membership.user_id = ${actor.id}
      )`;

  const result = await database.execute(sql`
    select
      (select count(*)::integer from leave_requests leave_request
       where ${leaveScope} and leave_request.status = 'pending') as pending_leaves,
      (select count(*)::integer from complaints complaint
       where ${complaintScope} and complaint.status <> 'closed') as open_complaints,
      (select count(*)::integer from complaints complaint
       where ${complaintScope}
         and complaint.status <> 'closed'
         and complaint.sla_deadline < ${now}) as sla_breached,
      (select count(*)::integer from leave_requests leave_request
       where ${leaveScope}
         and leave_request.status = 'exited'
         and not exists (
           select 1 from gate_events gate_event
           where gate_event.leave_request_id = leave_request.id
             and gate_event.movement = 'return'
         )) as students_outside,
      (select count(*)::integer from leave_requests leave_request
       where ${leaveScope}
         and leave_request.status = 'exited'
         and leave_request.expected_return_at < ${now}
         and not exists (
           select 1 from gate_events gate_event
           where gate_event.leave_request_id = leave_request.id
             and gate_event.movement = 'return'
         )) as overdue_returns,
      (select round(avg(feedback.rating)::numeric, 1)::float
       from mess_feedbacks feedback
       inner join mess_menus menu on menu.id = feedback.menu_id
       where ${menuScope}
         and menu.menu_date between ${period.from} and ${period.to}) as mess_average,
      (select count(*)::integer
       from mess_feedbacks feedback
       inner join mess_menus menu on menu.id = feedback.menu_id
       where ${menuScope}
         and menu.menu_date between ${period.from} and ${period.to}) as mess_responses
  `);
  const [record = {}] = rowsFrom(result);

  return Object.freeze({
    pendingLeaveRequests: metric(
      countOf(record.pending_leaves),
      "Leave requests currently awaiting a decision.",
      DASHBOARD_LINKS.MANAGED_LEAVES
    ),
    openComplaints: metric(
      countOf(record.open_complaints),
      DASHBOARD_DEFINITIONS.OPEN_COMPLAINTS,
      DASHBOARD_LINKS.MANAGED_COMPLAINTS
    ),
    slaBreachedComplaints: metric(
      countOf(record.sla_breached),
      DASHBOARD_DEFINITIONS.SLA_BREACHED,
      DASHBOARD_LINKS.MANAGED_COMPLAINTS
    ),
    studentsOutside: metric(
      countOf(record.students_outside),
      DASHBOARD_DEFINITIONS.STUDENTS_OUTSIDE,
      DASHBOARD_LINKS.GATE_TERMINAL
    ),
    overdueReturns: metric(
      countOf(record.overdue_returns),
      DASHBOARD_DEFINITIONS.OVERDUE_RETURNS,
      DASHBOARD_LINKS.GATE_TERMINAL
    ),
    messAverageRating: metric(
      averageOf(record.mess_average),
      DASHBOARD_DEFINITIONS.MESS_AVERAGE,
      DASHBOARD_LINKS.MANAGED_MESS,
      { responseCount: countOf(record.mess_responses), period }
    ),
  });
};

const getMaintenanceDashboard = async (database, actor, now) => {
  const result = await database.execute(sql`
    select
      count(*)::integer as assigned_count,
      count(*) filter (where complaint.sla_deadline < ${now})::integer as sla_breached,
      count(*) filter (where complaint.priority in ('critical', 'high'))::integer as high_priority
    from complaint_assignments assignment
    inner join complaints complaint on complaint.id = assignment.complaint_id
    where assignment.assignee_user_id = ${actor.id}
      and assignment.ended_at is null
      and complaint.status in ('created', 'assigned', 'in_progress')
  `);
  const [record = {}] = rowsFrom(result);
  const workResult = await database.execute(sql`
    select complaint.id, complaint.priority, complaint.status, complaint.sla_deadline,
           category.name as category_name
    from complaint_assignments assignment
    inner join complaints complaint on complaint.id = assignment.complaint_id
    inner join complaint_categories category on category.id = complaint.category_id
    where assignment.assignee_user_id = ${actor.id}
      and assignment.ended_at is null
      and complaint.status in ('created', 'assigned', 'in_progress')
    order by
      case complaint.priority
        when 'critical' then 1 when 'high' then 2 when 'medium' then 3 else 4
      end,
      complaint.sla_deadline,
      complaint.id
    limit 5
  `);

  return Object.freeze({
    assignedWork: metric(
      countOf(record.assigned_count),
      "Open actionable complaints with an active assignment to this staff member.",
      DASHBOARD_LINKS.MAINTENANCE_WORK
    ),
    slaBreachedWork: metric(
      countOf(record.sla_breached),
      "Assigned actionable complaints whose SLA deadline is earlier than the generated time.",
      DASHBOARD_LINKS.MAINTENANCE_WORK
    ),
    highPriorityWork: metric(
      countOf(record.high_priority),
      "Assigned actionable complaints with critical or high priority.",
      DASHBOARD_LINKS.MAINTENANCE_WORK
    ),
    workItems: rowsFrom(workResult).map((item) => Object.freeze({
      id: item.id,
      category: item.category_name,
      priority: item.priority,
      status: item.status,
      slaDeadline: item.sla_deadline,
      slaBreached: new Date(item.sla_deadline) < now,
      href: DASHBOARD_LINKS.MAINTENANCE_WORK,
    })),
  });
};

const getGuardDashboard = async (database, actor, now) => {
  const hostelScope = sql`leave_request.hostel_id in (
    select membership.hostel_id from hostel_memberships membership
    where membership.user_id = ${actor.id}
  )`;
  const result = await database.execute(sql`
    select
      count(*)::integer as students_outside,
      count(*) filter (where leave_request.expected_return_at < ${now})::integer as overdue_returns
    from leave_requests leave_request
    where ${hostelScope}
      and leave_request.status = 'exited'
      and not exists (
        select 1 from gate_events returned
        where returned.leave_request_id = leave_request.id
          and returned.movement = 'return'
      )
  `);
  const [record = {}] = rowsFrom(result);
  const movementResult = await database.execute(sql`
    select gate_event.id, gate_event.movement, gate_event.occurred_at,
           student.name as student_name, profile.roll_no, hostel.code as hostel_code
    from gate_events gate_event
    inner join leave_requests leave_request on leave_request.id = gate_event.leave_request_id
    inner join users student on student.id = leave_request.student_user_id
    inner join student_profiles profile on profile.id = leave_request.student_profile_id
    inner join hostels hostel on hostel.id = leave_request.hostel_id
    where ${hostelScope}
    order by gate_event.occurred_at desc, gate_event.id desc
    limit 5
  `);

  return Object.freeze({
    studentsOutside: metric(
      countOf(record.students_outside),
      DASHBOARD_DEFINITIONS.STUDENTS_OUTSIDE,
      DASHBOARD_LINKS.GATE_TERMINAL
    ),
    overdueReturns: metric(
      countOf(record.overdue_returns),
      DASHBOARD_DEFINITIONS.OVERDUE_RETURNS,
      DASHBOARD_LINKS.GATE_TERMINAL
    ),
    recentMovements: rowsFrom(movementResult).map((movement) => Object.freeze({
      id: movement.id,
      movement: movement.movement,
      occurredAt: movement.occurred_at,
      student: {
        name: movement.student_name,
        rollNo: movement.roll_no,
      },
      hostelCode: movement.hostel_code,
      href: DASHBOARD_LINKS.GATE_TERMINAL,
    })),
  });
};

const getAdministrationDashboard = async (database, now) => {
  const exceptionFrom = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const result = await database.execute(sql`
    select
      (select count(*)::integer from users) as total_users,
      (select count(*)::integer from users where account_status = 'active') as active_users,
      (select count(*)::integer from rooms where is_active = true) as active_rooms,
      (select coalesce(sum(capacity), 0)::integer from rooms where is_active = true) as capacity,
      (select count(*)::integer
       from room_allocations allocation
       inner join rooms room on room.id = allocation.room_id
       where allocation.vacated_at is null and room.is_active = true) as occupied_beds,
      (select count(*)::integer from audit_events audit_event
       where audit_event.created_at >= ${exceptionFrom}
         and audit_event.action in ('complaint.sla.breached', 'gate.movement.overridden')) as audit_exceptions
  `);
  const [record = {}] = rowsFrom(result);
  const capacity = countOf(record.capacity);
  const occupiedBeds = countOf(record.occupied_beds);

  return Object.freeze({
    totalUsers: metric(
      countOf(record.total_users),
      "All persisted user accounts regardless of current account status.",
      DASHBOARD_LINKS.STUDENT_ONBOARDING
    ),
    activeUsers: metric(
      countOf(record.active_users),
      "User accounts whose current account status is active.",
      DASHBOARD_LINKS.STUDENT_ONBOARDING
    ),
    activeRooms: metric(
      countOf(record.active_rooms),
      "Rooms currently enabled for allocation.",
      DASHBOARD_LINKS.RESIDENTS_AND_ROOMS
    ),
    roomOccupancy: metric(
      capacity === 0 ? null : Number(((occupiedBeds / capacity) * 100).toFixed(1)),
      DASHBOARD_DEFINITIONS.ROOM_OCCUPANCY,
      DASHBOARD_LINKS.RESIDENTS_AND_ROOMS,
      { occupiedBeds, capacity }
    ),
    auditExceptions: metric(
      countOf(record.audit_exceptions),
      DASHBOARD_DEFINITIONS.AUDIT_EXCEPTIONS,
      DASHBOARD_LINKS.AUDIT_LOG,
      { periodHours: 24 }
    ),
  });
};

export const getDashboardSummary = async (
  database,
  requestActor,
  { now = new Date() } = {}
) => {
  const generatedAt = validNow(now);
  const actor = await loadActor(database, requestActor);
  const period = dashboardPeriod(generatedAt);
  const hostelIds = [USER_ROLES.WARDEN, USER_ROLES.GUARD].includes(actor.role)
    ? await loadAssignedHostelIds(database, actor.id)
    : [];

  let data;
  if (actor.role === USER_ROLES.STUDENT) {
    data = await getStudentDashboard(database, actor, generatedAt, period);
  } else if (actor.role === USER_ROLES.WARDEN) {
    data = await getOperationsDashboard(database, actor, generatedAt, period);
  } else if (actor.role === USER_ROLES.MAINTENANCE) {
    data = await getMaintenanceDashboard(database, actor, generatedAt);
  } else if (actor.role === USER_ROLES.GUARD) {
    data = await getGuardDashboard(database, actor, generatedAt);
  } else if (actor.role === USER_ROLES.ADMIN) {
    data = Object.freeze({
      operations: await getOperationsDashboard(database, actor, generatedAt, period),
      administration: await getAdministrationDashboard(database, generatedAt),
    });
  } else {
    fail(403, "DASHBOARD_ACCESS_DENIED", "This role does not have a dashboard");
  }

  return Object.freeze({
    role: actor.role,
    generatedAt: generatedAt.toISOString(),
    scope: Object.freeze({
      kind: actor.role === USER_ROLES.ADMIN
        ? "institution"
        : [USER_ROLES.WARDEN, USER_ROLES.GUARD].includes(actor.role)
          ? "assigned_hostels"
          : actor.role === USER_ROLES.MAINTENANCE
            ? "active_assignments"
            : "own",
      hostelIds,
    }),
    data,
  });
};
