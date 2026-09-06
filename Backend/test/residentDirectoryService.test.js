import test from "node:test";
import assert from "node:assert/strict";
import { normalizeResidentDirectoryFilters } from "../src/services/residentDirectoryService.js";

test("resident directory filters normalize paging and room identifiers", () => {
  assert.deepEqual(
    normalizeResidentDirectoryFilters({
      page: "2",
      pageSize: "25",
      search: "  Kavya Nair  ",
      hostelCode: "h1",
      blockCode: "a",
      roomNumber: "101",
      accountStatus: "active",
    }),
    {
      page: 2,
      pageSize: 25,
      search: "Kavya Nair",
      hostelCode: "H1",
      blockCode: "A",
      roomNumber: "101",
      accountStatus: "active",
    }
  );
});

test("resident directory filters reject unsafe boundaries", () => {
  const invalidInputs = [
    [{ page: 0 }, "INVALID_PAGE"],
    [{ pageSize: 101 }, "INVALID_PAGE_SIZE"],
    [{ search: "x".repeat(101) }, "INVALID_SEARCH"],
    [{ hostelCode: "invalid code" }, "INVALID_HOSTEL"],
    [{ blockCode: "?" }, "INVALID_BLOCK"],
    [{ roomNumber: "room 101" }, "INVALID_ROOM"],
    [{ accountStatus: "deleted" }, "INVALID_ACCOUNT_STATUS"],
  ];

  for (const [input, code] of invalidInputs) {
    assert.throws(
      () => normalizeResidentDirectoryFilters(input),
      (error) => error.code === code
    );
  }
});
