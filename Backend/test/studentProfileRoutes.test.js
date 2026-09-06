import test from "node:test";
import assert from "node:assert/strict";

process.env.DATABASE_URL =
  "postgresql://hostelmate:secret@db.example.test:5432/hostelmate";
process.env.JWT_SECRET = "test-secret-with-at-least-32-characters";

const { default: studentProfileRoutes } = await import(
  "../src/Routes/studentProfileRoutes.js"
);

test("student profile API exposes only own-profile routes", () => {
  const routes = studentProfileRoutes.stack
    .filter((layer) => layer.route)
    .map((layer) => ({
      path: layer.route.path,
      methods: Object.keys(layer.route.methods).sort(),
      middlewareCount: layer.route.stack.length,
    }));

  assert.deepEqual(routes, [
    { path: "/", methods: ["get"], middlewareCount: 4 },
    { path: "/", methods: ["patch"], middlewareCount: 4 },
  ]);

  assert.equal(
    routes.some((route) => route.path.includes(":id")),
    false,
    "Students must not receive an ID-based profile route"
  );
});
