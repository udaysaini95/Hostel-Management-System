import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import {
  getNavigationForRole,
  getRoleHome,
  getRouteTitle,
  isNavigationItemActive,
  ROLE_LABELS,
} from "../src/layouts/navigation.js";

const appPath = fileURLToPath(new URL("../src/App.jsx", import.meta.url));
const shellStylesPath = fileURLToPath(
  new URL("../src/styles/shells.css", import.meta.url)
);
const publicShellPath = fileURLToPath(
  new URL("../src/layouts/PublicShell.jsx", import.meta.url)
);
const authenticatedShellPath = fileURLToPath(
  new URL("../src/layouts/AuthenticatedShell.jsx", import.meta.url)
);

const pathsForRole = (role) =>
  getNavigationForRole(role).map((item) => item.path);

test("navigation exposes only the currently implemented destinations per role", () => {
  assert.deepEqual(pathsForRole("student"), [
    "/student/dashboard",
    "/student/complaints",
    "/student/leaves",
    "/student/mess",
    "/student/profile",
  ]);
  assert.deepEqual(pathsForRole("warden"), [
    "/admin/dashboard",
    "/admin/residents",
    "/admin/complaints",
    "/admin/leaves",
    "/admin/mess",
  ]);
  assert.deepEqual(pathsForRole("admin"), [
    "/admin/dashboard",
    "/admin/student-approvals",
    "/admin/residents",
    "/admin/complaints",
    "/admin/leaves",
    "/admin/mess",
    "/guard/terminal",
  ]);
  assert.deepEqual(pathsForRole("guard"), ["/guard/terminal"]);
  assert.deepEqual(pathsForRole("maintenance"), ["/student/mess"]);
  assert.deepEqual(pathsForRole("unknown"), []);
});

test("every navigation destination exists in the application route tree", async () => {
  const appSource = await readFile(appPath, "utf8");
  const allNavigationPaths = new Set(
    Object.keys(ROLE_LABELS).flatMap(pathsForRole)
  );

  for (const path of allNavigationPaths) {
    assert.ok(appSource.includes(`path="${path}"`), `Missing route for ${path}`);
  }
});

test("role homes and nested navigation selection remain deterministic", () => {
  assert.equal(getRoleHome("student"), "/student/dashboard");
  assert.equal(getRoleHome("warden"), "/admin/dashboard");
  assert.equal(getRoleHome("admin"), "/admin/dashboard");
  assert.equal(getRoleHome("guard"), "/guard/terminal");
  assert.equal(getRoleHome("maintenance"), "/student/mess");
  assert.equal(getRoleHome("unknown"), "/");

  const complaintsItem = getNavigationForRole("student")[1];
  assert.equal(
    isNavigationItemActive("/student/complaints/raise", complaintsItem),
    true
  );
  assert.equal(isNavigationItemActive("/student/leaves", complaintsItem), false);
});

test("utility-bar titles describe every implemented authenticated route", () => {
  assert.equal(getRouteTitle("/student/dashboard"), "Overview");
  assert.equal(getRouteTitle("/student/complaints/raise"), "Raise complaint");
  assert.equal(getRouteTitle("/student/profile"), "My profile");
  assert.equal(getRouteTitle("/admin/residents"), "Residents and rooms");
  assert.equal(getRouteTitle("/admin/complaints"), "Complaint queue");
  assert.equal(
    getRouteTitle("/admin/student-approvals"),
    "Student onboarding"
  );
  assert.equal(getRouteTitle("/guard/terminal"), "Gate terminal");
  assert.equal(getRouteTitle("/not-yet-defined"), "HostelMate");
});

test("shell styles preserve the documented dimensions and breakpoints", async () => {
  const styles = await readFile(shellStylesPath, "utf8");

  assert.match(styles, /\.hm-public-header\s*{[\s\S]*?height:\s*4rem/);
  assert.match(styles, /\.hm-sidebar\s*{[\s\S]*?width:\s*14\.5rem/);
  assert.match(styles, /\.hm-utility-bar\s*{[\s\S]*?height:\s*3\.5rem/);
  assert.match(styles, /max-width:\s*75rem/);
  assert.match(styles, /max-width:\s*80rem/);
  assert.match(styles, /@media\s*\(max-width:\s*767px\)/);
  assert.match(styles, /@media\s*\(min-width:\s*1024px\)/);
  assert.match(styles, /@media\s*\(min-width:\s*1280px\)/);
});

test("both shells provide keyboard navigation landmarks", async () => {
  const [publicShell, authenticatedShell] = await Promise.all([
    readFile(publicShellPath, "utf8"),
    readFile(authenticatedShellPath, "utf8"),
  ]);

  assert.match(publicShell, /href="#main-content"/);
  assert.match(publicShell, /<main id="main-content"/);
  assert.match(authenticatedShell, /href="#app-main-content"/);
  assert.match(authenticatedShell, /<main id="app-main-content"/);
  assert.match(authenticatedShell, /aria-current={isActive \? "page"/);
  assert.match(authenticatedShell, /aria-label="Open navigation"/);
  assert.match(authenticatedShell, /aria-label="Sign out"/);
});
