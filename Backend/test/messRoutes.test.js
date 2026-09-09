import test from "node:test";
import assert from "node:assert/strict";

process.env.DATABASE_URL =
  "postgresql://hostelmate:secret@db.example.test:5432/hostelmate";
process.env.JWT_SECRET = "test-secret-with-at-least-32-characters";

const { default: messRoutes } = await import("../src/Routes/messRoutes.js");

const describeRoutes = (router) =>
  router.stack
    .filter((layer) => layer.route)
    .map((layer) => ({
      path: layer.route.path,
      methods: Object.keys(layer.route.methods).sort(),
      middlewareCount: layer.route.stack.length,
    }));

test("mess API exposes calendar routes before compatibility endpoints", () => {
  const routes = describeRoutes(messRoutes);

  assert.deepEqual(
    routes.slice(0, 5).map((route) => `${route.methods[0]} ${route.path}`),
    [
      "get /menus/hostels",
      "put /menus/:date",
      "get /menus/:date/versions",
      "get /menus/:date",
      "get /menus",
    ]
  );
  assert.equal(routes[0].middlewareCount, 3);
  assert.ok(routes.slice(1, 5).every((route) => route.middlewareCount === 4));
  assert.ok(routes.some((route) => route.path === "/today"));
  assert.ok(routes.some((route) => route.path === "/admin/create"));
  assert.ok(routes.some((route) => route.path === "/feedback" && route.methods.includes("post")));
  assert.ok(routes.some((route) => route.path === "/feedback/summary" && route.methods.includes("get")));
});
