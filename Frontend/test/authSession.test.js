import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import {
  canRoleAccessPath,
  ROLE_GROUPS,
  ROUTE_ACCESS,
} from "../src/auth/routeAccess.js";
import {
  clearStoredSession,
  getSessionEndMessage,
  normalizeSessionUser,
  readStoredToken,
  storeSession,
  updateStoredUser,
} from "../src/auth/session.js";

const appPath = fileURLToPath(new URL("../src/App.jsx", import.meta.url));
const mainPath = fileURLToPath(new URL("../src/main.jsx", import.meta.url));
const apiPath = fileURLToPath(
  new URL("../src/api/axios.js", import.meta.url)
);
const shellPath = fileURLToPath(
  new URL("../src/layouts/AuthenticatedShell.jsx", import.meta.url)
);

const createMemoryStorage = () => {
  const values = new Map();

  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
};

const demoUser = Object.freeze({
  id: 7,
  name: "Asha Rao",
  email: "asha.rao@college.edu",
  role: "student",
});

test("session persistence keeps one normalized user and clears every legacy key", () => {
  const storage = createMemoryStorage();

  assert.equal(storeSession({ token: "signed-token", user: demoUser }, storage), true);
  assert.equal(readStoredToken(storage), "signed-token");
  assert.deepEqual(JSON.parse(storage.getItem("user")), demoUser);
  assert.equal(storage.getItem("role"), "student");

  const updatedUser = { ...demoUser, name: "Asha R." };
  assert.equal(updateStoredUser(updatedUser, storage), true);
  assert.deepEqual(JSON.parse(storage.getItem("user")), updatedUser);

  clearStoredSession(storage);
  assert.equal(readStoredToken(storage), null);
  assert.equal(storage.getItem("user"), null);
  assert.equal(storage.getItem("role"), null);
});

test("session users require a real identity and a supported server role", () => {
  assert.deepEqual(normalizeSessionUser(demoUser), demoUser);
  assert.equal(normalizeSessionUser({ ...demoUser, id: 0 }), null);
  assert.equal(normalizeSessionUser({ ...demoUser, email: "" }), null);
  assert.equal(normalizeSessionUser({ ...demoUser, role: "super-admin" }), null);
});

test("route policy matches the current role boundaries", () => {
  assert.equal(canRoleAccessPath("student", "/student/dashboard"), true);
  assert.equal(canRoleAccessPath("student", "/admin/dashboard"), false);
  assert.equal(canRoleAccessPath("warden", "/admin/leaves"), true);
  assert.equal(
    canRoleAccessPath("warden", "/admin/student-approvals"),
    false
  );
  assert.equal(
    canRoleAccessPath("admin", "/admin/student-approvals"),
    true
  );
  assert.equal(canRoleAccessPath("warden", "/guard/terminal"), false);
  assert.equal(canRoleAccessPath("admin", "/guard/terminal"), true);
  assert.equal(canRoleAccessPath("guard", "/guard/terminal"), true);
  assert.equal(canRoleAccessPath("maintenance", "/student/mess"), true);
  assert.equal(canRoleAccessPath("unknown", "/unauthorized"), false);
  assert.equal(canRoleAccessPath("admin", "/missing"), false);

  assert.equal(ROUTE_ACCESS["/unauthorized"], ROLE_GROUPS.ALL);
});

test("session end messages distinguish expiry from invalid credentials", () => {
  assert.match(getSessionEndMessage("SESSION_EXPIRED"), /expired/i);
  assert.match(getSessionEndMessage("INVALID_ACCESS_TOKEN"), /no longer valid/i);
});

test("the application bootstraps auth and guards every private route group", async () => {
  const [appSource, mainSource, apiSource, shellSource] = await Promise.all([
    readFile(appPath, "utf8"),
    readFile(mainPath, "utf8"),
    readFile(apiPath, "utf8"),
    readFile(shellPath, "utf8"),
  ]);

  assert.match(mainSource, /<AuthProvider>/);
  assert.match(appSource, /<RequireAuthentication \/>/);
  assert.match(appSource, /ROLE_GROUPS\.STUDENT/);
  assert.match(appSource, /ROLE_GROUPS\.OPERATIONS/);
  assert.match(appSource, /ROLE_GROUPS\.ADMIN/);
  assert.match(appSource, /ROLE_GROUPS\.MESS_READER/);
  assert.match(appSource, /ROLE_GROUPS\.GATE_TERMINAL/);
  assert.match(appSource, /path="\/unauthorized"/);
  assert.match(appSource, /path="\*"/);
  assert.match(apiSource, /announceSessionEnded/);
  assert.doesNotMatch(shellSource, /localStorage/);
});
