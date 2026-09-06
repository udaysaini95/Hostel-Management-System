import test from "node:test";
import assert from "node:assert/strict";

process.env.DATABASE_URL =
  "postgresql://hostelmate:secret@db.example.test:5432/hostelmate";
process.env.JWT_SECRET = "test-secret-with-at-least-32-characters";

const { default: residentRoutes } = await import(
  "../src/Routes/residentRoutes.js"
);

test("resident directory API exposes one protected read route", () => {
  const routes = residentRoutes.stack
    .filter((layer) => layer.route)
    .map((layer) => ({
      path: layer.route.path,
      methods: Object.keys(layer.route.methods).sort(),
      middlewareCount: layer.route.stack.length,
    }));

  assert.deepEqual(routes, [
    { path: "/", methods: ["get"], middlewareCount: 4 },
  ]);
});
