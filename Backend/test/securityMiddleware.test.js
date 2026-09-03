import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { errorHandler } from "../src/middlewares/errorMiddleware.js";
import {
  applySecurityMiddleware,
  JSON_BODY_LIMIT,
} from "../src/middlewares/securityMiddleware.js";

const startTestServer = async (t, app) => {
  const server = await new Promise((resolve) => {
    const listeningServer = app.listen(0, "127.0.0.1", () => {
      resolve(listeningServer);
    });
  });

  t.after(
    () =>
      new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      })
  );

  const address = server.address();
  return `http://127.0.0.1:${address.port}`;
};

const createTestApp = () => {
  const app = express();

  applySecurityMiddleware(app, {
    corsAllowedOrigins: ["https://hostel.example"],
    trustProxyHops: 0,
  });
  app.get("/health", (req, res) => res.json({ status: "ok" }));
  app.post("/echo", (req, res) => res.json(req.body));
  app.use(errorHandler);

  return app;
};

test("security middleware sets defensive response headers", async (t) => {
  const app = createTestApp();
  const baseUrl = await startTestServer(t, app);
  const response = await fetch(`${baseUrl}/health`);

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("x-frame-options"), "SAMEORIGIN");
  assert.equal(response.headers.get("cross-origin-resource-policy"), "cross-origin");
  assert.ok(response.headers.get("content-security-policy"));
  assert.equal(response.headers.has("x-powered-by"), false);
});

test("CORS allows configured browser origins and rejects others", async (t) => {
  const app = createTestApp();
  const baseUrl = await startTestServer(t, app);

  const allowedResponse = await fetch(`${baseUrl}/health`, {
    headers: { Origin: "https://hostel.example" },
  });
  assert.equal(allowedResponse.status, 200);
  assert.equal(
    allowedResponse.headers.get("access-control-allow-origin"),
    "https://hostel.example"
  );

  const deniedResponse = await fetch(`${baseUrl}/health`, {
    headers: { Origin: "https://untrusted.example" },
  });
  assert.equal(deniedResponse.status, 403);
  assert.deepEqual(await deniedResponse.json(), {
    code: "CORS_ORIGIN_DENIED",
    message: "This web origin is not allowed to access the API",
  });
});

test("oversized JSON bodies return a controlled 413 response", async (t) => {
  assert.equal(JSON_BODY_LIMIT, "100kb");

  const app = createTestApp();
  const baseUrl = await startTestServer(t, app);
  const response = await fetch(`${baseUrl}/echo`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: "x".repeat(110 * 1024) }),
  });

  assert.equal(response.status, 413);
  assert.deepEqual(await response.json(), {
    code: "REQUEST_TOO_LARGE",
    message: "The request body is too large",
  });
});
