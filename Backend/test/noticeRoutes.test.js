import test from "node:test";
import assert from "node:assert/strict";

process.env.DATABASE_URL =
  "postgresql://hostelmate:secret@db.example.test:5432/hostelmate";
process.env.JWT_SECRET = "test-secret-with-at-least-32-characters";

const { default: noticeRoutes } = await import("../src/Routes/noticeRoutes.js");

test("notice API exposes publishing, inbox, unread count, and read state", () => {
  const routes = noticeRoutes.stack
    .filter((layer) => layer.route)
    .map((layer) => `${Object.keys(layer.route.methods)[0]} ${layer.route.path}`);

  assert.deepEqual(routes, [
    "post /",
    "get /mine",
    "get /unread-count",
    "get /managed",
    "patch /:id/read",
  ]);
});
