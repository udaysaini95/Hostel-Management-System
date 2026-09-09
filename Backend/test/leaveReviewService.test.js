import test from "node:test";
import assert from "node:assert/strict";
import { normalizeLeaveReviewFilters } from "../src/services/leaveReviewService.js";

test("leave review filters default to the pending operational queue", () => {
  assert.deepEqual(normalizeLeaveReviewFilters({}), {
    page: 1,
    pageSize: 15,
    status: "pending",
    search: "",
  });
});

test("leave review filters support bounded history search", () => {
  assert.deepEqual(
    normalizeLeaveReviewFilters({
      page: "2",
      pageSize: "25",
      status: "all",
      search: "  LD-002  ",
    }),
    { page: 2, pageSize: 25, status: null, search: "LD-002" }
  );
  assert.throws(
    () => normalizeLeaveReviewFilters({ status: "cancelled" }),
    (error) => error.code === "INVALID_LEAVE_STATUS"
  );
  assert.throws(
    () => normalizeLeaveReviewFilters({ search: "x".repeat(101) }),
    (error) => error.code === "INVALID_SEARCH"
  );
});
