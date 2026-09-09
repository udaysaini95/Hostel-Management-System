import {
  and,
  asc,
  desc,
  eq,
  gte,
  inArray,
  lte,
  sql,
} from "drizzle-orm";
import {
  hostelMemberships,
  hostels,
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
import { MEAL_TYPE_ORDER, MEAL_TYPES } from "../domain/mess.js";
import { USER_ROLES } from "../domain/roles.js";
import { ApiError } from "../utils/apiErrors.js";
import { appendAuditEvent } from "./auditEventService.js";

const fail = (status, code, message) => {
  throw new ApiError(status, code, message);
};

export const normalizeMenuDate = (value) => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    fail(400, "INVALID_MENU_DATE", "Menu date must use YYYY-MM-DD format");
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    fail(400, "INVALID_MENU_DATE", "Menu date is not a valid calendar date");
  }

  return value;
};

const normalizeMealItems = (items, mealType, required) => {
  if (items === undefined && !required) return [];
  if (!Array.isArray(items) || items.length < 1 || items.length > 30) {
    fail(400, "INVALID_MENU_ITEMS", `${mealType} must contain 1 to 30 items`);
  }

  const normalized = items.map((item) =>
    typeof item === "string" ? item.trim().replace(/\s+/g, " ") : ""
  );
  if (normalized.some((item) => item.length < 1 || item.length > 100)) {
    fail(400, "INVALID_MENU_ITEMS", "Each menu item must contain 1 to 100 characters");
  }

  const uniqueNames = new Set(normalized.map((item) => item.toLocaleLowerCase("en")));
  if (uniqueNames.size !== normalized.length) {
    fail(400, "DUPLICATE_MENU_ITEM", `${mealType} contains a duplicate item`);
  }

  return normalized;
};

export const normalizeMenuMeals = (input = {}) => {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    fail(400, "INVALID_MENU", "Meals must be an object");
  }

  const allowedKeys = new Set(MEAL_TYPE_ORDER);
  if (Object.keys(input).some((key) => !allowedKeys.has(key))) {
    fail(400, "INVALID_MEAL_TYPE", "Menu contains an unsupported meal type");
  }

  return Object.freeze({
    [MEAL_TYPES.BREAKFAST]: normalizeMealItems(input.breakfast, "Breakfast", true),
    [MEAL_TYPES.LUNCH]: normalizeMealItems(input.lunch, "Lunch", true),
    [MEAL_TYPES.SNACKS]: normalizeMealItems(input.snacks, "Snacks", false),
    [MEAL_TYPES.DINNER]: normalizeMealItems(input.dinner, "Dinner", true),
  });
};

export const normalizeMenuRange = ({ from, to }) => {
  const normalizedFrom = normalizeMenuDate(from);
  const normalizedTo = normalizeMenuDate(to);
  if (normalizedFrom > normalizedTo) {
    fail(400, "INVALID_MENU_RANGE", "To must be after or equal to From");
  }

  const rangeMilliseconds =
    Date.parse(`${normalizedTo}T00:00:00.000Z`) -
    Date.parse(`${normalizedFrom}T00:00:00.000Z`);
  if (rangeMilliseconds > 62 * 24 * 60 * 60 * 1000) {
    fail(400, "MENU_RANGE_TOO_LARGE", "Menu ranges cannot exceed 62 days");
  }

  return Object.freeze({ from: normalizedFrom, to: normalizedTo });
};

const requireActor = async (database, requestActor) => {
  const actorId = Number(requestActor?.id);
  if (!Number.isSafeInteger(actorId) || actorId < 1) {
    fail(401, "AUTHENTICATION_REQUIRED", "Authentication is required");
  }

  const [actor] = await database
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      accountStatus: users.accountStatus,
    })
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
  if (!hostel.isActive) fail(409, "HOSTEL_INACTIVE", "Mess menus are unavailable for an inactive hostel");
  return hostel;
};

const resolveMenuHostel = async (
  database,
  actor,
  requestedHostelId,
  { manage = false, allowAdminDefault = false } = {}
) => {
  if (actor.role === USER_ROLES.STUDENT) {
    if (manage) fail(403, "MESS_MENU_MANAGE_DENIED", "Students cannot publish mess menus");

    const [profile] = await database
      .select({ hostelId: studentProfiles.hostelId })
      .from(studentProfiles)
      .where(eq(studentProfiles.userId, actor.id))
      .limit(1);
    if (!profile) fail(409, "STUDENT_PROFILE_REQUIRED", "A student hostel profile is required");
    if (requestedHostelId && requestedHostelId !== profile.hostelId) {
      fail(403, "MESS_MENU_ACCESS_DENIED", "Students can only view their assigned hostel menu");
    }
    return loadHostel(database, profile.hostelId);
  }

  if (manage && ![USER_ROLES.WARDEN, USER_ROLES.ADMIN].includes(actor.role)) {
    fail(403, "MESS_MENU_MANAGE_DENIED", "Only wardens and administrators can publish mess menus");
  }

  let hostelId = Number(requestedHostelId || 0);
  if (!hostelId && actor.role === USER_ROLES.ADMIN && !allowAdminDefault) {
    fail(400, "HOSTEL_REQUIRED", "Select a hostel");
  }

  if (!hostelId) {
    const [membership] = await database
      .select({ hostelId: hostelMemberships.hostelId })
      .from(hostelMemberships)
      .where(eq(hostelMemberships.userId, actor.id))
      .orderBy(desc(hostelMemberships.isPrimary), asc(hostelMemberships.id))
      .limit(1);
    if (!membership) fail(403, "HOSTEL_ACCESS_DENIED", "No hostel is assigned to this account");
    hostelId = membership.hostelId;
  }

  if (actor.role !== USER_ROLES.ADMIN) {
    const [membership] = await database
      .select({ id: hostelMemberships.id })
      .from(hostelMemberships)
      .where(and(eq(hostelMemberships.userId, actor.id), eq(hostelMemberships.hostelId, hostelId)))
      .limit(1);
    if (!membership) fail(403, "HOSTEL_ACCESS_DENIED", "This hostel is outside your assignment");
  }

  return loadHostel(database, hostelId);
};

const emptyMeals = () => ({ breakfast: [], lunch: [], snacks: [], dinner: [] });

const groupItems = (rows) => {
  const mealsByVersion = new Map();
  for (const row of rows) {
    const meals = mealsByVersion.get(row.menuVersionId) || emptyMeals();
    meals[row.mealType].push(row.name);
    mealsByVersion.set(row.menuVersionId, meals);
  }
  return mealsByVersion;
};

const formatMenu = (record, meals) => Object.freeze({
  id: record.id,
  date: record.date,
  version: record.version,
  hostel: Object.freeze({ id: record.hostelId, code: record.hostelCode, name: record.hostelName }),
  publishedBy: Object.freeze({ id: record.publisherId, name: record.publisherName }),
  publishedAt: record.publishedAt,
  meals: Object.freeze(meals || emptyMeals()),
});

const loadCurrentMenuRecords = async (database, hostel, { date, from, to }) => {
  const conditions = [eq(messMenus.hostelId, hostel.id)];
  if (date) conditions.push(eq(messMenus.menuDate, date));
  if (from) conditions.push(gte(messMenus.menuDate, from));
  if (to) conditions.push(lte(messMenus.menuDate, to));

  return database
    .select({
      id: messMenus.id,
      date: messMenus.menuDate,
      version: messMenuVersions.version,
      menuVersionId: messMenuVersions.id,
      hostelId: hostels.id,
      hostelCode: hostels.code,
      hostelName: hostels.name,
      publisherId: users.id,
      publisherName: users.name,
      publishedAt: messMenuVersions.publishedAt,
    })
    .from(messMenus)
    .innerJoin(hostels, eq(messMenus.hostelId, hostels.id))
    .innerJoin(
      messMenuVersions,
      and(eq(messMenuVersions.menuId, messMenus.id), eq(messMenuVersions.version, messMenus.currentVersion))
    )
    .innerJoin(users, eq(messMenuVersions.publishedByUserId, users.id))
    .where(and(...conditions))
    .orderBy(asc(messMenus.menuDate));
};

const attachItems = async (database, records) => {
  if (records.length === 0) return [];
  const versionIds = records.map((record) => record.menuVersionId);
  const items = await database
    .select({
      menuVersionId: messMenuItems.menuVersionId,
      mealType: messMenuItems.mealType,
      name: messMenuItems.name,
    })
    .from(messMenuItems)
    .where(inArray(messMenuItems.menuVersionId, versionIds))
    .orderBy(asc(messMenuItems.mealType), asc(messMenuItems.position));
  const mealsByVersion = groupItems(items);
  return records.map((record) => formatMenu(record, mealsByVersion.get(record.menuVersionId)));
};

export const publishMessMenu = async (
  database,
  requestActor,
  input,
  { now = new Date(), allowDefaultHostel = false } = {}
) => {
  const date = normalizeMenuDate(input.date);
  const meals = normalizeMenuMeals(input.meals);
  const hostelId = Number(input.hostelId);
  if ((!Number.isSafeInteger(hostelId) || hostelId < 1) && !allowDefaultHostel) {
    fail(400, "INVALID_HOSTEL", "Hostel ID must be a positive integer");
  }
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    fail(400, "INVALID_OPERATION_TIME", "Publication timestamp is invalid");
  }

  return database.transaction(async (transaction) => {
    const actor = await requireActor(transaction, requestActor);
    const hostel = await resolveMenuHostel(transaction, actor, hostelId, {
      manage: true,
      allowAdminDefault: allowDefaultHostel,
    });

    await transaction.execute(
      sql`select pg_advisory_xact_lock(hashtext(${`mess-menu:${hostel.id}:${date}`}))`
    );

    const [existing] = await transaction
      .select({ id: messMenus.id, currentVersion: messMenus.currentVersion })
      .from(messMenus)
      .where(and(eq(messMenus.hostelId, hostel.id), eq(messMenus.menuDate, date)))
      .limit(1);

    const nextVersion = existing ? existing.currentVersion + 1 : 1;
    let menuId;
    if (existing) {
      menuId = existing.id;
      await transaction
        .update(messMenus)
        .set({ currentVersion: nextVersion, updatedAt: now })
        .where(eq(messMenus.id, menuId));
    } else {
      const [menu] = await transaction
        .insert(messMenus)
        .values({ hostelId: hostel.id, menuDate: date, currentVersion: 1, createdAt: now, updatedAt: now })
        .returning({ id: messMenus.id });
      menuId = menu.id;
    }

    const [revision] = await transaction
      .insert(messMenuVersions)
      .values({ menuId, version: nextVersion, publishedByUserId: actor.id, publishedAt: now })
      .returning({ id: messMenuVersions.id });

    const itemRows = MEAL_TYPE_ORDER.flatMap((mealType) =>
      meals[mealType].map((name, index) => ({
        menuVersionId: revision.id,
        mealType,
        position: index + 1,
        name,
      }))
    );
    await transaction.insert(messMenuItems).values(itemRows);

    await appendAuditEvent(transaction, {
      actor,
      category: AUDIT_CATEGORIES.MESS,
      action: existing ? AUDIT_ACTIONS.MESS_MENU_UPDATED : AUDIT_ACTIONS.MESS_MENU_PUBLISHED,
      resourceType: AUDIT_RESOURCE_TYPES.MESS_MENU,
      resourceId: menuId,
      description: `${existing ? "Updated" : "Published"} ${date} menu for ${hostel.code}`,
      metadata: { date, version: nextVersion },
      assignedHostels: [hostel],
      createdAt: now,
    });

    return formatMenu({
      id: menuId,
      date,
      version: nextVersion,
      hostelId: hostel.id,
      hostelCode: hostel.code,
      hostelName: hostel.name,
      publisherId: actor.id,
      publisherName: actor.name,
      publishedAt: now,
    }, meals);
  });
};

export const getMessMenuByDate = async (database, requestActor, input) => {
  const date = normalizeMenuDate(input.date);
  const actor = await requireActor(database, requestActor);
  const hostel = await resolveMenuHostel(database, actor, Number(input.hostelId || 0));
  const records = await loadCurrentMenuRecords(database, hostel, { date });
  if (records.length === 0) {
    fail(404, "MESS_MENU_NOT_FOUND", "No menu is published for this date");
  }
  const [menu] = await attachItems(database, records);
  return menu;
};

export const listMessMenus = async (database, requestActor, input) => {
  const range = normalizeMenuRange(input);
  const actor = await requireActor(database, requestActor);
  const hostel = await resolveMenuHostel(database, actor, Number(input.hostelId || 0));
  const records = await loadCurrentMenuRecords(database, hostel, range);
  return Object.freeze({
    hostel: Object.freeze({ id: hostel.id, code: hostel.code, name: hostel.name }),
    range,
    menus: await attachItems(database, records),
  });
};

export const listManageableMessHostels = async (database, requestActor) => {
  const actor = await requireActor(database, requestActor);
  if (![USER_ROLES.WARDEN, USER_ROLES.ADMIN].includes(actor.role)) {
    fail(403, "MESS_MENU_MANAGE_DENIED", "Only wardens and administrators can publish mess menus");
  }

  const conditions = [eq(hostels.isActive, true)];
  let query = database
    .select({ id: hostels.id, code: hostels.code, name: hostels.name })
    .from(hostels);

  if (actor.role === USER_ROLES.WARDEN) {
    query = query.innerJoin(
      hostelMemberships,
      and(
        eq(hostelMemberships.hostelId, hostels.id),
        eq(hostelMemberships.userId, actor.id)
      )
    );
  }

  const records = await query.where(and(...conditions)).orderBy(asc(hostels.code));
  return Object.freeze({ hostels: records.map((hostel) => Object.freeze(hostel)) });
};

export const listMessMenuVersions = async (database, requestActor, input) => {
  const date = normalizeMenuDate(input.date);
  const actor = await requireActor(database, requestActor);
  const hostel = await resolveMenuHostel(database, actor, Number(input.hostelId || 0), { manage: true });
  const [menu] = await database
    .select({ id: messMenus.id })
    .from(messMenus)
    .where(and(eq(messMenus.hostelId, hostel.id), eq(messMenus.menuDate, date)))
    .limit(1);
  if (!menu) fail(404, "MESS_MENU_NOT_FOUND", "No menu is published for this date");

  const records = await database
    .select({
      id: messMenus.id,
      date: messMenus.menuDate,
      version: messMenuVersions.version,
      menuVersionId: messMenuVersions.id,
      hostelId: hostels.id,
      hostelCode: hostels.code,
      hostelName: hostels.name,
      publisherId: users.id,
      publisherName: users.name,
      publishedAt: messMenuVersions.publishedAt,
    })
    .from(messMenuVersions)
    .innerJoin(messMenus, eq(messMenuVersions.menuId, messMenus.id))
    .innerJoin(hostels, eq(messMenus.hostelId, hostels.id))
    .innerJoin(users, eq(messMenuVersions.publishedByUserId, users.id))
    .where(eq(messMenuVersions.menuId, menu.id))
    .orderBy(desc(messMenuVersions.version));

  return Object.freeze({
    menuId: menu.id,
    date,
    hostel: Object.freeze({ id: hostel.id, code: hostel.code, name: hostel.name }),
    versions: await attachItems(database, records),
  });
};
