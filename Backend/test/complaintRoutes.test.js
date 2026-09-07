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
