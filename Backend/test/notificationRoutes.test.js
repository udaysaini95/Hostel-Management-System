import test from "node:test";
import assert from "node:assert/strict";

process.env.DATABASE_URL =
  "postgresql://hostelmate:secret@db.example.test:5432/hostelmate";
process.env.JWT_SECRET = "test-secret-with-at-least-32-characters";

const { default: notificationRoutes } = await import("../src/Routes/notificationRoutes.js");

test("notification API exposes inbox, count, and read actions", () => {
  const routes = notificationRoutes.stack
    .filter((layer) => layer.route)
    .map((layer) => `${Object.keys(layer.route.methods)[0]} ${layer.route.path}`);

  assert.deepEqual(routes, [
    "get /",
    "get /unread-count",
    "patch /read-all",
    "patch /:id/read",
  ]);
});
