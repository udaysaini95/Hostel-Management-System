import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import {
  formatDashboardStatus,
  groupMenuItems,
  isDashboardMetric,
} from "../src/dashboard/dashboardView.js";

const dashboardStylesPath = fileURLToPath(
  new URL("../src/styles/dashboard.css", import.meta.url)
);

test("dashboard helpers preserve domain labels and meal order", () => {
  assert.equal(formatDashboardStatus("in_progress"), "In Progress");
  assert.deepEqual(
    groupMenuItems([
      { mealType: "breakfast", name: "Poha" },
      { mealType: "breakfast", name: "Fruit" },
      { mealType: "lunch", name: "Dal and rice" },
    ]),
    [
      { mealType: "breakfast", names: ["Poha", "Fruit"] },
      { mealType: "lunch", names: ["Dal and rice"] },
    ]
  );
});

test("dashboard metrics distinguish unavailable data from a real null value", () => {
  assert.equal(isDashboardMetric(undefined), false);
  assert.equal(isDashboardMetric({ value: null, definition: "No responses." }), true);
  assert.equal(isDashboardMetric({ value: 0, definition: "No open records." }), true);
});

test("dashboard styles cap desktop metric rows and collapse for mobile", async () => {
  const styles = await readFile(dashboardStylesPath, "utf8");

  assert.match(styles, /grid-template-columns:\s*repeat\(4,/);
  assert.match(styles, /@media\s*\(max-width:\s*767px\)/);
  assert.match(styles, /\.hm-dashboard-record\s*{[\s\S]*?flex-direction:\s*column/);
  assert.doesNotMatch(styles, /gradient|backdrop-filter|filter:\s*blur/i);
});
