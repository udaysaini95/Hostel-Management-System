import test from "node:test";
import assert from "node:assert/strict";
import {
  messMenuRangeQuerySchema,
  publishMessMenuSchema,
} from "../src/validation/messSchemas.js";

test("calendar menu validation keeps the date separate from timestamps", () => {
  const valid = publishMessMenuSchema.params.safeParse({ date: "2026-09-10" });
  const timestamp = publishMessMenuSchema.params.safeParse({
    date: "2026-09-10T00:00:00+05:30",
  });

  assert.equal(valid.success, true);
  assert.equal(timestamp.success, false);
});

test("menu publication validation rejects unknown meals and empty required meals", () => {
  const result = publishMessMenuSchema.body.safeParse({
    hostelId: 1,
    meals: {
      breakfast: [],
      lunch: ["Rice"],
      dinner: ["Dal"],
      midnightMeal: ["Noodles"],
    },
  });

  assert.equal(result.success, false);
});

test("menu range validation rejects reversed and excessive calendar ranges", () => {
  assert.equal(
    messMenuRangeQuerySchema.query.safeParse({
      from: "2026-09-01",
      to: "2026-09-30",
    }).success,
    true
  );
  assert.equal(
    messMenuRangeQuerySchema.query.safeParse({
      from: "2026-09-30",
      to: "2026-09-01",
    }).success,
    false
  );
});
