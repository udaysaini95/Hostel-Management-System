import { and, asc, desc, eq, gte, lte, sql } from "drizzle-orm";
import {
  hostelMemberships,
  hostels,
  messFeedbacks,
  messMenuItems,
  messMenus,
  messMenuVersions,
  studentProfiles,
  users,
} from "../db/schema.js";
import { ACCOUNT_STATUSES } from "../domain/accountStatuses.js";
import {
  AUDIT_ACTIONS,
  AUDIT_CATEGORIES,
  AUDIT_RESOURCE_TYPES,
} from "../domain/auditEvents.js";
import { MEAL_TYPE_ORDER } from "../domain/mess.js";
import { USER_ROLES } from "../domain/roles.js";
import { ApiError } from "../utils/apiErrors.js";
import { appendAuditEvent } from "./auditEventService.js";
import { normalizeMenuDate } from "./messMenuService.js";

const fail = (status, code, message) => {
  throw new ApiError(status, code, message);
};

const positiveInteger = (value, code, message) => {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 1) fail(400, code, message);
  return number;
};

export const normalizeMessFeedback = (input = {}) => {
  const menuId = positiveInteger(input.menuId, "INVALID_MENU", "Select a published menu");
  const rating = Number(input.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    fail(400, "INVALID_RATING", "Rating must be a whole number from 1 to 5");
  }
  if (!MEAL_TYPE_ORDER.includes(input.mealType)) {
    fail(400, "INVALID_MEAL_TYPE", "Select a meal from the published menu");
  }

  const comment = typeof input.comment === "string" ? input.comment.trim() : "";
  if (comment.length > 1000) {
    fail(400, "COMMENT_TOO_LONG", "Comment cannot exceed 1000 characters");
  }

  return Object.freeze({ menuId, mealType: input.mealType, rating, comment: comment || null });
};

export const normalizeFeedbackRange = ({ from, to }) => {
  const range = { from: normalizeMenuDate(from), to: normalizeMenuDate(to) };
  if (range.from > range.to) fail(400, "INVALID_FEEDBACK_RANGE", "To must be after or equal to From");
  const milliseconds = Date.parse(`${range.to}T00:00:00Z`) - Date.parse(`${range.from}T00:00:00Z`);
  if (milliseconds > 366 * 24 * 60 * 60 * 1000) {
    fail(400, "FEEDBACK_RANGE_TOO_LARGE", "Feedback ranges cannot exceed 366 days");
  }
  return Object.freeze(range);
};

const loadActor = async (database, requestActor) => {
  const actorId = positiveInteger(
    requestActor?.id,
    "AUTHENTICATION_REQUIRED",
    "Authentication is required"
  );
  const [actor] = await database
    .select({ id: users.id, name: users.name, email: users.email, role: users.role, accountStatus: users.accountStatus })
    .from(users)
    .where(eq(users.id, actorId))
    .limit(1);
  if (!actor || actor.accountStatus !== ACCOUNT_STATUSES.ACTIVE) {
    fail(403, "ACCOUNT_INACTIVE", "An active account is required");
  }
  return actor;
};

const loadHostel = async (database, hostelId) => {
  const [hostel] = await database
    .select({ id: hostels.id, code: hostels.code, name: hostels.name, isActive: hostels.isActive })
    .from(hostels)
    .where(eq(hostels.id, hostelId))
    .limit(1);
  if (!hostel) fail(404, "HOSTEL_NOT_FOUND", "Hostel not found");
  if (!hostel.isActive) fail(409, "HOSTEL_INACTIVE", "Feedback is unavailable for an inactive hostel");
  return hostel;
};

const loadManagedHostel = async (database, actor, requestedHostelId) => {
  if (![USER_ROLES.WARDEN, USER_ROLES.ADMIN].includes(actor.role)) {
    fail(403, "MESS_FEEDBACK_READ_DENIED", "Only wardens and administrators can view feedback analytics");
  }
  const hostelId = positiveInteger(requestedHostelId, "INVALID_HOSTEL", "Select a hostel");
  if (actor.role === USER_ROLES.WARDEN) {
    const [membership] = await database
      .select({ id: hostelMemberships.id })
      .from(hostelMemberships)
      .where(and(eq(hostelMemberships.userId, actor.id), eq(hostelMemberships.hostelId, hostelId)))
      .limit(1);
    if (!membership) fail(403, "HOSTEL_ACCESS_DENIED", "This hostel is outside your assignment");
  }
  return loadHostel(database, hostelId);
};

const databaseError = (error) => {
  let current = error;
  while (current) {
    if (current.code || current.constraint) return current;
    current = current.cause;
  }
  return error;
};

export const submitMessFeedback = async (database, requestActor, input, { now = new Date() } = {}) => {
  const feedback = normalizeMessFeedback(input);
  try {
    return await database.transaction(async (transaction) => {
      const actor = await loadActor(transaction, requestActor);
      if (actor.role !== USER_ROLES.STUDENT) {
        fail(403, "STUDENT_FEEDBACK_REQUIRED", "Only students can submit meal ratings");
      }

      const [profile] = await transaction
        .select({ hostelId: studentProfiles.hostelId })
        .from(studentProfiles)
        .where(eq(studentProfiles.userId, actor.id))
        .limit(1);
      if (!profile) fail(409, "STUDENT_PROFILE_REQUIRED", "A student hostel profile is required");

      const [menu] = await transaction
        .select({
          id: messMenus.id,
          date: messMenus.menuDate,
          hostelId: messMenus.hostelId,
          versionId: messMenuVersions.id,
        })
        .from(messMenus)
        .innerJoin(
          messMenuVersions,
          and(eq(messMenuVersions.menuId, messMenus.id), eq(messMenuVersions.version, messMenus.currentVersion))
        )
        .where(eq(messMenus.id, feedback.menuId))
        .limit(1);
      if (!menu) fail(404, "MESS_MENU_NOT_FOUND", "The selected menu is no longer available");
      if (menu.hostelId !== profile.hostelId) {
        fail(403, "MESS_FEEDBACK_ACCESS_DENIED", "You can only rate meals from your assigned hostel");
      }

      const [meal] = await transaction
        .select({ id: messMenuItems.id })
        .from(messMenuItems)
        .where(and(eq(messMenuItems.menuVersionId, menu.versionId), eq(messMenuItems.mealType, feedback.mealType)))
        .limit(1);
      if (!meal) fail(409, "MEAL_NOT_PUBLISHED", "That meal is not present in the selected menu");

      const [created] = await transaction
        .insert(messFeedbacks)
        .values({
          menuId: menu.id,
          menuVersionId: menu.versionId,
          studentUserId: actor.id,
          mealType: feedback.mealType,
          rating: feedback.rating,
          comment: feedback.comment,
          submittedAt: now,
        })
        .returning();

      const hostel = await loadHostel(transaction, menu.hostelId);
      await appendAuditEvent(transaction, {
        actor,
        category: AUDIT_CATEGORIES.MESS,
        action: AUDIT_ACTIONS.MESS_FEEDBACK_SUBMITTED,
        resourceType: AUDIT_RESOURCE_TYPES.MESS_FEEDBACK,
        resourceId: created.id,
        description: `Rated ${feedback.mealType} for the ${menu.date} menu`,
        metadata: { menuId: menu.id, menuDate: menu.date, mealType: feedback.mealType, rating: feedback.rating },
        assignedHostels: [hostel],
        createdAt: now,
      });
      return Object.freeze(created);
    });
  } catch (error) {
    const cause = databaseError(error);
    if (cause?.code === "23505" && cause.constraint === "mess_feedbacks_student_menu_meal_unique") {
      fail(409, "MEAL_ALREADY_RATED", "You have already rated this meal for the selected date");
    }
    throw error;
  }
};

export const getMessFeedbackSummary = async (database, requestActor, input) => {
  const range = normalizeFeedbackRange(input);
  const actor = await loadActor(database, requestActor);
  const hostel = await loadManagedHostel(database, actor, input.hostelId);
  if (input.mealType && !MEAL_TYPE_ORDER.includes(input.mealType)) {
    fail(400, "INVALID_MEAL_TYPE", "Select a valid meal type");
  }

  const conditions = [
    eq(messMenus.hostelId, hostel.id),
    gte(messMenus.menuDate, range.from),
    lte(messMenus.menuDate, range.to),
  ];
  if (input.mealType) conditions.push(eq(messFeedbacks.mealType, input.mealType));

  const rows = await database
    .select({
      mealType: messFeedbacks.mealType,
      responseCount: sql`count(*)::int`,
      ratingTotal: sql`sum(${messFeedbacks.rating})::int`,
      averageRating: sql`round(avg(${messFeedbacks.rating})::numeric, 1)::float`,
    })
    .from(messFeedbacks)
    .innerJoin(messMenus, eq(messFeedbacks.menuId, messMenus.id))
    .where(and(...conditions))
    .groupBy(messFeedbacks.mealType)
    .orderBy(asc(messFeedbacks.mealType));

  const responseCount = rows.reduce((sum, row) => sum + Number(row.responseCount), 0);
  const weightedTotal = rows.reduce(
    (sum, row) => sum + Number(row.ratingTotal),
    0
  );
  const recentComments = await database
    .select({
      id: messFeedbacks.id,
      mealType: messFeedbacks.mealType,
      rating: messFeedbacks.rating,
      comment: messFeedbacks.comment,
      submittedAt: messFeedbacks.submittedAt,
      menuDate: messMenus.menuDate,
      studentName: users.name,
    })
    .from(messFeedbacks)
    .innerJoin(messMenus, eq(messFeedbacks.menuId, messMenus.id))
    .innerJoin(users, eq(messFeedbacks.studentUserId, users.id))
    .where(and(...conditions, sql`${messFeedbacks.comment} is not null`))
    .orderBy(desc(messFeedbacks.submittedAt))
    .limit(20);

  return Object.freeze({
    hostel: Object.freeze({ id: hostel.id, code: hostel.code, name: hostel.name }),
    range,
    overall: Object.freeze({
      averageRating: responseCount ? Number((weightedTotal / responseCount).toFixed(1)) : null,
      responseCount,
    }),
    byMeal: rows.map((row) => Object.freeze({
      mealType: row.mealType,
      averageRating: Number(row.averageRating),
      responseCount: Number(row.responseCount),
    })),
    recentComments: recentComments.map((comment) => Object.freeze(comment)),
  });
};
