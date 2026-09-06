import test from "node:test";
import assert from "node:assert/strict";
import { normalizeRoomInventoryFilters } from "../src/services/roomAllocationService.js";

test("room filters normalize codes and pagination", () => {
  assert.deepEqual(
    normalizeRoomInventoryFilters({
      page: "2",
      pageSize: "25",
      hostelCode: " h1 ",
      blockCode: " a-1 ",
      availability: " AVAILABLE ",
    }),
    {
      page: 2,
      pageSize: 25,
      hostelCode: "H1",
      blockCode: "A-1",
      availability: "available",
    }
  );
});

test("room filters reject invalid boundaries", () => {
  const invalidFilters = [
    [{ page: 0 }, "INVALID_PAGE"],
    [{ pageSize: 101 }, "INVALID_PAGE_SIZE"],
    [{ hostelCode: "1H" }, "INVALID_HOSTEL"],
    [{ blockCode: "?" }, "INVALID_BLOCK"],
    [{ availability: "vacant" }, "INVALID_AVAILABILITY"],
  ];

  for (const [filters, code] of invalidFilters) {
    assert.throws(
      () => normalizeRoomInventoryFilters(filters),
      (error) => error.code === code
    );
  }
});
