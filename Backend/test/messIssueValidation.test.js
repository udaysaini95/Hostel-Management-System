import test from "node:test";
import assert from "node:assert/strict";
import {
  createMessIssueSchema,
  managedMessIssueListSchema,
  messIssueStatusUpdateSchema,
} from "../src/validation/messIssueSchemas.js";

test("mess issue requests normalize fixed values and bounded pagination", () => {
  const creation = createMessIssueSchema.body.safeParse({
    issueType: "hygiene",
    mealType: "dinner",
    description: "Tables were not cleaned after dinner.",
  });
  const filters = managedMessIssueListSchema.query.safeParse({ page: "2", pageSize: "20" });

  assert.equal(creation.success, true);
  assert.deepEqual(filters.data, { page: 2, pageSize: 20 });
});

test("mess issue validation rejects unknown states and skipped input", () => {
  assert.equal(messIssueStatusUpdateSchema.body.safeParse({ status: "closed" }).success, false);
  assert.equal(createMessIssueSchema.body.safeParse({
    issueType: "hygiene",
    mealType: "midnight",
    description: "This description is otherwise long enough.",
  }).success, false);
});
