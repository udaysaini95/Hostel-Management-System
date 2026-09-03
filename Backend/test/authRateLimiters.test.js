import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createAuthRateLimiter } from "../src/middlewares/authRateLimiters.js";

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

const post = (url, body = {}) =>
  fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

test("failed authentication attempts are throttled", async (t) => {
  const app = express();
  app.use(express.json());
  app.post(
    "/login",
    createAuthRateLimiter({
      limit: 2,
      message: "Too many failed sign-in attempts. Please try again later.",
      skipSuccessfulRequests: true,
      windowMs: 60_000,
    }),
    (req, res) => res.status(401).json({ message: "Invalid credentials" })
  );

  const baseUrl = await startTestServer(t, app);
  const firstResponse = await post(`${baseUrl}/login`);
  const secondResponse = await post(`${baseUrl}/login`);
  const blockedResponse = await post(`${baseUrl}/login`);

  assert.equal(firstResponse.status, 401);
  assert.equal(secondResponse.status, 401);
  assert.equal(blockedResponse.status, 429);
  assert.ok(blockedResponse.headers.get("retry-after"));
  assert.ok(blockedResponse.headers.get("ratelimit"));
  assert.deepEqual(await blockedResponse.json(), {
    code: "AUTH_RATE_LIMITED",
    message: "Too many failed sign-in attempts. Please try again later.",
  });
});

test("successful authentication does not consume the failure budget", async (t) => {
  const app = express();
  app.use(express.json());
  app.post(
    "/login",
    createAuthRateLimiter({
      limit: 1,
      message: "Too many failed sign-in attempts. Please try again later.",
      skipSuccessfulRequests: true,
      windowMs: 60_000,
    }),
    (req, res) =>
      req.body.succeeds
        ? res.json({ authenticated: true })
        : res.status(401).json({ authenticated: false })
  );

  const baseUrl = await startTestServer(t, app);

  assert.equal((await post(`${baseUrl}/login`, { succeeds: true })).status, 200);
  assert.equal((await post(`${baseUrl}/login`, { succeeds: true })).status, 200);
  assert.equal((await post(`${baseUrl}/login`)).status, 401);
  assert.equal((await post(`${baseUrl}/login`)).status, 429);
});

test("activation request limits count successful privacy-safe responses", async (t) => {
  const app = express();
  app.post(
    "/activation",
    createAuthRateLimiter({
      limit: 1,
      message: "Too many activation requests. Please try again later.",
      windowMs: 60_000,
    }),
    (req, res) => res.status(202).json({ accepted: true })
  );

  const baseUrl = await startTestServer(t, app);

  assert.equal((await post(`${baseUrl}/activation`)).status, 202);
  assert.equal((await post(`${baseUrl}/activation`)).status, 429);
});
