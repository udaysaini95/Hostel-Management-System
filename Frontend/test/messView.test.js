import test from "node:test";
import assert from "node:assert/strict";
import {
  addCalendarDays,
  getCalendarRange,
  menuToEditor,
  validateMenuEditor,
} from "../src/mess/messView.js";

test("menu calendar helpers preserve date-only values across month boundaries", () => {
  assert.equal(addCalendarDays("2026-01-31", 1), "2026-02-01");
  assert.equal(addCalendarDays("2028-02-28", 1), "2028-02-29");
  assert.deepEqual(getCalendarRange("2026-12-29"), {
    from: "2026-12-29",
    to: "2027-01-04",
  });
});

test("menu editor creates normalized API meals and catches duplicate items", () => {
  const valid = validateMenuEditor({
    breakfast: "Poha\n Tea ",
    lunch: "Rajma\nRice",
    snacks: "",
    dinner: "Roti\nDal",
  });
  assert.equal(valid.valid, true);
  assert.deepEqual(valid.meals.breakfast, ["Poha", "Tea"]);
  assert.equal("snacks" in valid.meals, false);

  const duplicate = validateMenuEditor({
    breakfast: "Tea\n tea",
    lunch: "Rice",
    snacks: "",
    dinner: "Dal",
  });
  assert.equal(duplicate.valid, false);
  assert.match(duplicate.errors.breakfast, /duplicate/i);
});

test("published menus convert to readable line-based editor fields", () => {
  const fields = menuToEditor({
    meals: {
      breakfast: ["Idli", "Sambar"],
      lunch: ["Rice"],
      snacks: [],
      dinner: ["Dal"],
    },
  });
  assert.equal(fields.breakfast, "Idli\nSambar");
  assert.equal(fields.snacks, "");
});

