import test from "node:test";
import assert from "node:assert/strict";

process.env.DATABASE_URL =
  "postgresql://hostelmate:secret@db.example.test:5432/hostelmate";
process.env.JWT_SECRET = "test-secret-with-at-least-32-characters";

const { default: reportRoutes } = await import("../src/Routes/reportRoutes.js");

test("report API exposes four authenticated validated read routes", () => {
  const routes = reportRoutes.stack
    .filter((layer) => layer.route)
    .map((layer) => ({
      path: layer.route.path,
      methods: Object.keys(layer.route.methods),
      handlers: layer.route.stack.length,
    }));

  assert.deepEqual(routes, [
    { path: "/complaints", methods: ["get"], handlers: 4 },
    { path: "/leaves", methods: ["get"], handlers: 4 },
    { path: "/gate", methods: ["get"], handlers: 4 },
    { path: "/mess", methods: ["get"], handlers: 4 },
  ]);
});
