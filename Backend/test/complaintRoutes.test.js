import test from "node:test";
import assert from "node:assert/strict";

process.env.DATABASE_URL =
  "postgresql://hostelmate:secret@db.example.test:5432/hostelmate";
process.env.JWT_SECRET = "test-secret-with-at-least-32-characters";

const { default: complaintRoutes } = await import(
  "../src/Routes/complaintRoutes.js"
);

const describeRoutes = (router) =>
  router.stack
    .filter((layer) => layer.route)
    .map((layer) => ({
      path: layer.route.path,
      methods: Object.keys(layer.route.methods).sort(),
      middlewareCount: layer.route.stack.length,
    }));

test("complaints expose normalized create, list, category, and detail routes", () => {
  const routes = describeRoutes(complaintRoutes);

  assert.deepEqual(routes.slice(0, 4), [
    { path: "/", methods: ["post"], middlewareCount: 4 },
    { path: "/categories", methods: ["get"], middlewareCount: 3 },
    { path: "/mine", methods: ["get"], middlewareCount: 4 },
    { path: "/managed", methods: ["get"], middlewareCount: 4 },
  ]);
  assert.deepEqual(routes.at(-1), {
    path: "/:id",
    methods: ["get"],
    middlewareCount: 3,
  });
});

test("named compatibility routes are registered before the dynamic detail route", () => {
  const routes = describeRoutes(complaintRoutes);
  const detailIndex = routes.findIndex(
    (route) => route.path === "/:id" && route.methods.includes("get")
  );

  assert.ok(detailIndex > routes.findIndex((route) => route.path === "/my"));
  assert.ok(
    detailIndex >
      routes.findIndex((route) => route.path === "/admin/complaints")
  );
});

test("complaint attachments use authenticated collection and resource routes", () => {
  const routes = describeRoutes(complaintRoutes);
  const attachmentRoutes = routes.filter((route) =>
    route.path.includes("/attachments")
  );

  assert.deepEqual(attachmentRoutes, [
    { path: "/:id/attachments", methods: ["post"], middlewareCount: 5 },
    { path: "/:id/attachments", methods: ["get"], middlewareCount: 3 },
    {
      path: "/:id/attachments/:attachmentId",
      methods: ["get"],
      middlewareCount: 3,
    },
    {
      path: "/:id/attachments/:attachmentId",
      methods: ["delete"],
      middlewareCount: 3,
    },
  ]);
});

test("complaints expose scoped assignment and maintenance queue routes", () => {
  const routes = describeRoutes(complaintRoutes);

  assert.ok(
    routes.some(
      (route) =>
        route.path === "/assignees" &&
        route.methods.includes("get") &&
        route.middlewareCount === 4
    )
  );
  assert.ok(
    routes.some(
      (route) =>
        route.path === "/work-queue" &&
        route.methods.includes("get") &&
        route.middlewareCount === 4
    )
  );
  assert.ok(
    routes.some(
      (route) =>
        route.path === "/:id/assignments" &&
        route.methods.includes("post") &&
        route.middlewareCount === 4
    )
  );
});
