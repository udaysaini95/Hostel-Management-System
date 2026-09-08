import test from "node:test";
import assert from "node:assert/strict";

process.env.DATABASE_URL =
  "postgresql://hostelmate:secret@db.example.test:5432/hostelmate";
process.env.JWT_SECRET = "test-secret-with-at-least-32-characters";

const { default: leaveRoutes } = await import("../src/Routes/leaveRoutes.js");

const describeRoutes = (router) =>
  router.stack
    .filter((layer) => layer.route)
    .map((layer) => ({
      path: layer.route.path,
      methods: Object.keys(layer.route.methods).sort(),
      middlewareCount: layer.route.stack.length,
    }));

test("leave routes expose normalized submission before compatibility routes", () => {
  const routes = describeRoutes(leaveRoutes);

  assert.deepEqual(routes[0], {
    path: "/",
    methods: ["post"],
    middlewareCount: 4,
  });
  assert.ok(
    routes.some(
      (route) =>
        route.path === "/" &&
        route.methods.includes("get") &&
        route.middlewareCount === 4
    )
  );
  assert.ok(
    routes.some(
      (route) => route.path === "/apply" && route.methods.includes("post")
    )
  );
  assert.ok(
    routes.some(
      (route) =>
        route.path === "/:id/decision" &&
        route.methods.includes("post") &&
        route.middlewareCount === 4
    )
  );
  for (const path of ["/:id/pass", "/:id/pass/qr", "/:id/pass/pdf"]) {
    assert.ok(
      routes.some(
        (route) =>
          route.path === path &&
          route.methods.includes("get") &&
          route.middlewareCount === 4
      )
    );
  }
});
