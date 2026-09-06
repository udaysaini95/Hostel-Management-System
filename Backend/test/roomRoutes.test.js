import test from "node:test";
import assert from "node:assert/strict";

process.env.DATABASE_URL =
  "postgresql://hostelmate:secret@db.example.test:5432/hostelmate";
process.env.JWT_SECRET = "test-secret-with-at-least-32-characters";

const [{ default: roomRoutes }, { default: roomAllocationRoutes }] =
  await Promise.all([
    import("../src/Routes/roomRoutes.js"),
    import("../src/Routes/roomAllocationRoutes.js"),
  ]);

const describeRoutes = (router) =>
  router.stack
    .filter((layer) => layer.route)
    .map((layer) => ({
      path: layer.route.path,
      methods: Object.keys(layer.route.methods).sort(),
      middlewareCount: layer.route.stack.length,
    }));

test("room inventory exposes one protected read route", () => {
  assert.deepEqual(describeRoutes(roomRoutes), [
    { path: "/", methods: ["get"], middlewareCount: 4 },
  ]);
});

test("room allocations expose protected create and vacancy routes", () => {
  assert.deepEqual(describeRoutes(roomAllocationRoutes), [
    { path: "/", methods: ["post"], middlewareCount: 4 },
    { path: "/:id/vacate", methods: ["patch"], middlewareCount: 4 },
  ]);
});
