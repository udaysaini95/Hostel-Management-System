import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeMenuDate,
  normalizeMenuMeals,
  normalizeMenuRange,
} from "../src/services/messMenuService.js";

test("mess menus preserve calendar dates without timezone conversion", () => {
  assert.equal(normalizeMenuDate("2026-01-01"), "2026-01-01");
  assert.equal(normalizeMenuDate("2026-12-31"), "2026-12-31");
  assert.throws(() => normalizeMenuDate("2026-02-29"), {
    code: "INVALID_MENU_DATE",
  });
  assert.throws(() => normalizeMenuDate("2026-01-01T00:00:00+05:30"), {
    code: "INVALID_MENU_DATE",
  });
});

test("mess menu items are readable, bounded, and unique within a meal", () => {
  const meals = normalizeMenuMeals({
    breakfast: ["  Vegetable   poha ", "Tea"],
    lunch: ["Rajma", "Rice"],
    snacks: ["Fruit"],
    dinner: ["Roti", "Dal"],
  });

  assert.deepEqual(meals.breakfast, ["Vegetable poha", "Tea"]);
  assert.deepEqual(meals.snacks, ["Fruit"]);
  assert.throws(
    () => normalizeMenuMeals({
      breakfast: ["Tea", " tea "],
      lunch: ["Rice"],
      dinner: ["Dal"],
    }),
    { code: "DUPLICATE_MENU_ITEM" }
  );
});

test("menu calendar browsing uses an ordered bounded range", () => {
  assert.deepEqual(
    normalizeMenuRange({ from: "2026-09-01", to: "2026-09-30" }),
    { from: "2026-09-01", to: "2026-09-30" }
  );
  assert.throws(
    () => normalizeMenuRange({ from: "2026-09-02", to: "2026-09-01" }),
    { code: "INVALID_MENU_RANGE" }
  );
  assert.throws(
    () => normalizeMenuRange({ from: "2026-01-01", to: "2026-04-01" }),
    { code: "MENU_RANGE_TOO_LARGE" }
  );
});

