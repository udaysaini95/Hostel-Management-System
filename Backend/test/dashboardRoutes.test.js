import test from "node:test";
import assert from "node:assert/strict";

process.env.DATABASE_URL =
  "postgresql://hostelmate:secret@db.example.test:5432/hostelmate";
process.env.JWT_SECRET = "test-secret-with-at-least-32-characters";

const { default: dashboardRoutes } = await import("../src/Routes/dashboardRoutes.js");

test("dashboard API exposes one authenticated role-aware summary route", () => {
  const routes = dashboardRoutes.stack
    .filter((layer) => layer.route)
    .map((layer) => `${Object.keys(layer.route.methods)[0]} ${layer.route.path}`);

  assert.deepEqual(routes, ["get /"]);
  assert.equal(dashboardRoutes.stack[0].route.stack.length, 3);
});
