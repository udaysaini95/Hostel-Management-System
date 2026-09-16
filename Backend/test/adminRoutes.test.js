import test from "node:test";
import assert from "node:assert/strict";

process.env.DATABASE_URL =
  "postgresql://hostelmate:secret@db.example.test:5432/hostelmate";
process.env.JWT_SECRET = "test-secret-with-at-least-32-characters";

const { default: adminRoutes } = await import("../src/Routes/adminRoutes.js");

test("admin API exposes account, hostel, and student lifecycle routes", () => {
  const routes = adminRoutes.stack
    .filter((layer) => layer.route)
    .map((layer) => ({
      path: layer.route.path,
      methods: Object.keys(layer.route.methods).sort(),
    }));

  assert.deepEqual(routes, [
    { path: "/staff/invitations", methods: ["post"] },
    { path: "/accounts/:id/status", methods: ["patch"] },
    { path: "/students/approvals", methods: ["post"] },
    { path: "/students/approvals/import", methods: ["post"] },
    { path: "/hostels", methods: ["get"] },
    { path: "/hostels", methods: ["post"] },
    { path: "/hostels/:id/status", methods: ["patch"] },
    { path: "/hostels/:id", methods: ["patch"] },
    { path: "/hostels/:id/inventory", methods: ["get"] },
    { path: "/hostels/:id/blocks", methods: ["post"] },
    { path: "/hostels/:id/blocks/:blockId/status", methods: ["patch"] },
    { path: "/hostels/:id/blocks/:blockId", methods: ["patch"] },
    { path: "/hostels/:id/blocks/:blockId/rooms", methods: ["post"] },
    { path: "/hostels/:id/rooms/:roomId/status", methods: ["patch"] },
    { path: "/hostels/:id/rooms/:roomId", methods: ["patch"] },
    { path: "/students/approvals", methods: ["get"] },
    { path: "/students/approvals/:id/revoke", methods: ["patch"] },
    { path: "/students/approvals/:id/reinstate", methods: ["patch"] },
    {
      path: "/students/approvals/:id/activation-email",
      methods: ["post"],
    },
  ]);
});
