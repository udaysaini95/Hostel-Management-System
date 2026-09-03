import test from "node:test";
import assert from "node:assert/strict";
import {
  auditEventHostels,
  auditEvents,
  hostelMemberships,
} from "../src/db/schema.js";
import {
  AUDIT_ACTIONS,
  AUDIT_CATEGORIES,
  AUDIT_RESOURCE_TYPES,
} from "../src/domain/auditEvents.js";
import { USER_ROLES } from "../src/domain/roles.js";
import {
  appendAuditEvent,
  createAuditActorSnapshot,
  getAuditVisibility,
  searchAuditEvents,
} from "../src/services/auditEventService.js";

const createQueryDatabase = (results) => {
  const queries = [];

  return {
    queries,
    select(selection) {
      const result = results.shift() ?? [];
      const query = {
        selection,
        joins: [],
        whereClause: null,
        from(table) {
          this.table = table;
          return this;
        },
        innerJoin(table) {
          this.joins.push(table);
          return this;
        },
        where(condition) {
          this.whereClause = condition;
          return this;
        },
        orderBy() {
          return this;
        },
        limit(value) {
          this.limitValue = value;
          return this;
        },
        offset(value) {
          this.offsetValue = value;
          return this;
        },
        then(resolve, reject) {
          return Promise.resolve(result).then(resolve, reject);
        },
      };

      queries.push(query);
      return query;
    },
  };
};

test("actor snapshots preserve readable normalized identity", () => {
  const actor = createAuditActorSnapshot({
    id: "7",
    name: "  Admin User  ",
    email: "  ADMIN@Example.COM  ",
    role: USER_ROLES.ADMIN,
  });

  assert.deepEqual(actor, {
    userId: 7,
    name: "Admin User",
    email: "admin@example.com",
    role: USER_ROLES.ADMIN,
  });
  assert.equal(Object.isFrozen(actor), true);
});

test("audit visibility follows role and hostel boundaries", () => {
  assert.deepEqual(getAuditVisibility({ id: 1, role: USER_ROLES.ADMIN }), {
    kind: "all",
  });
  assert.deepEqual(getAuditVisibility({ id: 2, role: USER_ROLES.WARDEN }), {
    kind: "hostel",
    categories: [
      "student",
      "room",
      "complaint",
      "leave",
      "gate",
      "mess",
      "notice",
    ],
  });
  assert.deepEqual(getAuditVisibility({ id: 3, role: USER_ROLES.GUARD }), {
    kind: "hostel",
    categories: ["gate"],
  });
  assert.deepEqual(
    getAuditVisibility({ id: 4, role: USER_ROLES.MAINTENANCE }),
    { kind: "own" }
  );
  assert.deepEqual(getAuditVisibility({ id: 5, role: USER_ROLES.STUDENT }), {
    kind: "none",
  });
});

test("audit writes store safe snapshots and unique hostel scopes", async () => {
  const inserts = [];
  const database = {
    insert(table) {
      if (table === auditEvents) {
        return {
          values(values) {
            inserts.push({ table, values });
            return {
              returning: async () => [{ id: 42, ...values }],
            };
          },
        };
      }

      if (table === auditEventHostels) {
        return {
          values: async (values) => {
            inserts.push({ table, values });
          },
        };
      }

      throw new Error("Unexpected audit table");
    },
  };
  const createdAt = new Date("2026-09-04T10:00:00.000Z");

  const event = await appendAuditEvent(database, {
    actor: {
      id: 7,
      name: "Admin User",
      email: "admin@example.com",
      role: USER_ROLES.ADMIN,
    },
    category: AUDIT_CATEGORIES.ACCOUNT,
    action: AUDIT_ACTIONS.STAFF_INVITATION_CREATED,
    resourceType: AUDIT_RESOURCE_TYPES.STAFF_INVITATION,
    resourceId: 15,
    description: "Created a warden invitation",
    metadata: { invitedRole: USER_ROLES.WARDEN },
    assignedHostels: [
      { id: 1, code: "h1" },
      { id: 2, code: "H2" },
      { id: 1, code: "H1" },
    ],
    createdAt,
  });

  assert.equal(inserts.length, 2);
  assert.equal(inserts[0].values.actorName, "Admin User");
  assert.equal(inserts[0].values.resourceId, "15");
  assert.equal(inserts[0].values.createdAt, createdAt);
  assert.deepEqual(inserts[1].values, [
    { auditEventId: 42, hostelId: 1, hostelCode: "H1" },
    { auditEventId: 42, hostelId: 2, hostelCode: "H2" },
  ]);
  assert.deepEqual(event.hostels, [
    { id: 1, code: "H1" },
    { id: 2, code: "H2" },
  ]);
  assert.equal(Object.isFrozen(event), true);
});

test("audit writes reject invalid categories and metadata", async () => {
  const database = {
    insert: () => assert.fail("Invalid events must not reach the database"),
  };
  const baseEvent = {
    actor: {
      id: 7,
      name: "Admin User",
      email: "admin@example.com",
      role: USER_ROLES.ADMIN,
    },
    category: AUDIT_CATEGORIES.ACCOUNT,
    action: AUDIT_ACTIONS.ACCOUNT_STATUS_CHANGED,
    resourceType: AUDIT_RESOURCE_TYPES.USER_ACCOUNT,
    resourceId: 8,
    description: "Changed account status",
  };

  await assert.rejects(
    appendAuditEvent(database, { ...baseEvent, category: "secret" }),
    (error) => error.code === "INVALID_AUDIT_EVENT"
  );
  await assert.rejects(
    appendAuditEvent(database, { ...baseEvent, metadata: [] }),
    (error) => error.code === "INVALID_AUDIT_EVENT"
  );
});

test("admin audit searches return pagination and hostel snapshots", async () => {
  const database = createQueryDatabase([
    [{ total: 1 }],
    [
      {
        id: 42,
        action: AUDIT_ACTIONS.STUDENT_APPROVAL_CREATED,
        createdAt: new Date("2026-09-04T10:00:00.000Z"),
      },
    ],
    [{ auditEventId: 42, id: 1, code: "H1" }],
  ]);

  const result = await searchAuditEvents(
    database,
    { id: 7, role: USER_ROLES.ADMIN },
    { page: 2, pageSize: 10 }
  );

  assert.deepEqual(result.pagination, {
    page: 2,
    pageSize: 10,
    total: 1,
    totalPages: 1,
  });
  assert.deepEqual(result.data[0].hostels, [{ id: 1, code: "H1" }]);
  assert.equal(database.queries[1].limitValue, 10);
  assert.equal(database.queries[1].offsetValue, 10);
});

test("warden audit searches add a hostel-membership boundary", async () => {
  const database = createQueryDatabase([[], [{ total: 0 }], []]);

  const result = await searchAuditEvents(
    database,
    { id: 8, role: USER_ROLES.WARDEN },
    { page: 1, pageSize: 25 }
  );

  assert.deepEqual(result.data, []);
  assert.ok(database.queries[0].joins.includes(hostelMemberships));
  assert.ok(database.queries[1].whereClause);
  assert.ok(database.queries[2].whereClause);
});
