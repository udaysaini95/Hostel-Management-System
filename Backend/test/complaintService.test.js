import test from "node:test";
import assert from "node:assert/strict";
import {
  COMPLAINT_PRIORITIES,
  COMPLAINT_STATUSES,
} from "../src/domain/complaintWorkflow.js";
import {
  determineComplaintPriority,
  normalizeComplaintFilters,
  normalizeComplaintInput,
  searchOwnComplaints,
} from "../src/services/complaintService.js";

test("complaint input is normalized before it reaches the database", () => {
  assert.deepEqual(
    normalizeComplaintInput({
      categoryCode: " Electrical ",
      location: " Block A, Room 101 ",
      description: "  The ceiling light is flickering.  ",
      requestedPriority: COMPLAINT_PRIORITIES.HIGH,
      hostelCode: "h1",
      roomId: "7",
    }),
    {
      categoryCode: "electrical",
      location: "Block A, Room 101",
      description: "The ceiling light is flickering.",
      requestedPriority: COMPLAINT_PRIORITIES.HIGH,
      hostelCode: "H1",
      roomId: 7,
    }
  );
});

test("category policy prevents a requester from lowering priority", () => {
  assert.equal(
    determineComplaintPriority(
      COMPLAINT_PRIORITIES.HIGH,
      COMPLAINT_PRIORITIES.LOW
    ),
    COMPLAINT_PRIORITIES.HIGH
  );
  assert.equal(
    determineComplaintPriority(
      COMPLAINT_PRIORITIES.MEDIUM,
      COMPLAINT_PRIORITIES.CRITICAL
    ),
    COMPLAINT_PRIORITIES.CRITICAL
  );
});

test("complaint list filters normalize paging, scope, and sorting", () => {
  assert.deepEqual(
    normalizeComplaintFilters({
      page: "2",
      pageSize: "25",
      search: "  leaking tap ",
      hostelCode: "h2",
      categoryCode: " Plumbing ",
      status: COMPLAINT_STATUSES.CREATED,
      priority: COMPLAINT_PRIORITIES.HIGH,
      slaState: "breached",
      sortBy: "slaDeadline",
      sortOrder: "asc",
    }),
    {
      page: 2,
      pageSize: 25,
      search: "leaking tap",
      hostelCode: "H2",
      categoryCode: "plumbing",
      status: COMPLAINT_STATUSES.CREATED,
      priority: COMPLAINT_PRIORITIES.HIGH,
      slaState: "breached",
      sortBy: "slaDeadline",
      sortOrder: "asc",
    }
  );
});

test("complaint inputs reject unsafe values before database access", () => {
  const invalidCases = [
    [
      { categoryCode: "?", location: "Room 1", description: "Long enough text" },
      "INVALID_COMPLAINT_CATEGORY",
    ],
    [
      { categoryCode: "other", location: "", description: "Long enough text" },
      "INVALID_COMPLAINT_LOCATION",
    ],
    [
      { categoryCode: "other", location: "Room 1", description: "short" },
      "INVALID_COMPLAINT_DESCRIPTION",
    ],
    [
      {
        categoryCode: "other",
        location: "Room 1",
        description: "Long enough text",
        requestedPriority: "urgent",
      },
      "INVALID_COMPLAINT_PRIORITY",
    ],
  ];

  for (const [input, code] of invalidCases) {
    assert.throws(
      () => normalizeComplaintInput(input),
      (error) => error.code === code
    );
  }

  assert.throws(
    () => normalizeComplaintFilters({ pageSize: 101 }),
    (error) => error.code === "INVALID_PAGE_SIZE"
  );
  assert.throws(
    () => normalizeComplaintFilters({ status: "waiting" }),
    (error) => error.code === "INVALID_COMPLAINT_STATUS"
  );
});

test("complaint services reject a missing actor before database access", async () => {
  await assert.rejects(
    searchOwnComplaints(null, null, {}),
    (error) =>
      error.statusCode === 401 && error.code === "AUTHENTICATION_REQUIRED"
  );
});
