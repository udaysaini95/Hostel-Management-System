import test from "node:test";
import assert from "node:assert/strict";

process.env.DATABASE_URL =
  "postgresql://hostelmate:secret@db.example.test:5432/hostelmate";
process.env.JWT_SECRET = "test-secret-with-at-least-32-characters";

const { default: adminRoutes } = await import("../src/Routes/adminRoutes.js");

test("admin API exposes the approved-student lifecycle routes", () => {
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
    { path: "/students/approvals", methods: ["get"] },
    { path: "/students/approvals/:id/revoke", methods: ["patch"] },
    { path: "/students/approvals/:id/reinstate", methods: ["patch"] },
    {
      path: "/students/approvals/:id/activation-email",
      methods: ["post"],
    },
  ]);
});
