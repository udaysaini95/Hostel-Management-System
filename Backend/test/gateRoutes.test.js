import test from "node:test";
import assert from "node:assert/strict";

process.env.DATABASE_URL =
  "postgresql://hostelmate:secret@db.example.test:5432/hostelmate";
process.env.JWT_SECRET = "test-secret-with-at-least-32-characters";

const { default: gateRoutes } = await import("../src/Routes/gateRoutes.js");

const describeRoutes = (router) =>
  router.stack
    .filter((layer) => layer.route)
    .map((layer) => ({
      path: layer.route.path,
      methods: Object.keys(layer.route.methods).sort(),
      middlewareCount: layer.route.stack.length,
    }));

test("gate API exposes secure verification before compatibility routes", () => {
  const routes = describeRoutes(gateRoutes);

  assert.deepEqual(routes[0], {
    path: "/passes/verify",
    methods: ["post"],
    middlewareCount: 4,
  });
  assert.ok(routes.some((route) => route.path === "/verify"));
});
