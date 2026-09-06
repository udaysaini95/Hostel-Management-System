import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import {
  ACTIVATION_REQUEST_SUCCESS_MESSAGE,
  ACTIVATION_UNAVAILABLE_MESSAGE,
  isActivationTokenValid,
  normalizeActivationRequest,
  PASSWORD_MAX_BYTES,
  PASSWORD_MIN_LENGTH,
  validateActivationPassword,
  validateActivationRequest,
} from "../src/onboarding/studentActivation.js";

const appPath = fileURLToPath(new URL("../src/App.jsx", import.meta.url));
const requestPagePath = fileURLToPath(
  new URL("../src/pages/StudentActivationRequest.jsx", import.meta.url)
);
const completionPagePath = fileURLToPath(
  new URL("../src/pages/StudentActivationComplete.jsx", import.meta.url)
);
const publicShellPath = fileURLToPath(
  new URL("../src/layouts/PublicShell.jsx", import.meta.url)
);
const activationStylesPath = fileURLToPath(
  new URL("../src/styles/studentActivation.css", import.meta.url)
);

test("activation requests normalize the approved institutional identity", () => {
  assert.deepEqual(
    normalizeActivationRequest({
      email: "  ASHA.RAO@COLLEGE.EDU ",
      rollNo: " 2026   cse 042 ",
    }),
    {
      email: "asha.rao@college.edu",
      rollNo: "2026 CSE 042",
    }
  );

  assert.deepEqual(
    validateActivationRequest({
      email: "asha.rao@college.edu",
      rollNo: "2026-CSE-042",
    }),
    {}
  );
  assert.deepEqual(Object.keys(validateActivationRequest({
    email: "not-an-email",
    rollNo: "?",
  })), ["email", "rollNo"]);
});

test("password setup matches the backend length and UTF-8 byte policy", () => {
  assert.equal(PASSWORD_MIN_LENGTH, 12);
  assert.equal(PASSWORD_MAX_BYTES, 72);
  assert.deepEqual(
    validateActivationPassword({
      password: "correct horse battery staple",
      confirmPassword: "correct horse battery staple",
    }),
    {}
  );
  assert.match(
    validateActivationPassword({
      password: "short",
      confirmPassword: "short",
    }).password,
    /12 characters/
  );
  assert.match(
    validateActivationPassword({
      password: "a".repeat(73),
      confirmPassword: "a".repeat(73),
    }).password,
    /72 UTF-8 bytes/
  );
  assert.match(
    validateActivationPassword({
      password: "correct horse battery staple",
      confirmPassword: "different password",
    }).confirmPassword,
    /do not match/
  );
});

test("activation links use the same strict token format as the backend", () => {
  assert.equal(isActivationTokenValid("a".repeat(43)), true);
  assert.equal(isActivationTokenValid("A0_-".repeat(10) + "ABC"), true);
  assert.equal(isActivationTokenValid("too-short"), false);
  assert.equal(isActivationTokenValid("!".repeat(43)), false);
  assert.match(ACTIVATION_UNAVAILABLE_MESSAGE, /invalid, expired, or has already been used/i);
});

test("legacy registration routes now use the privacy-safe activation flow", async () => {
  const [app, requestPage, completionPage, publicShell] = await Promise.all([
    readFile(appPath, "utf8"),
    readFile(requestPagePath, "utf8"),
    readFile(completionPagePath, "utf8"),
    readFile(publicShellPath, "utf8"),
  ]);

  assert.match(app, /path="\/register" element={<StudentActivationRequest \/>}/);
  assert.match(app, /path="\/student\/register"[\s\S]*?<StudentActivationRequest \/>/);
  assert.match(app, /path="\/activate-student"[\s\S]*?<StudentActivationComplete \/>/);
  assert.doesNotMatch(app, /StudentRegister/);
  assert.match(requestPage, /\/api\/auth\/student-activation\/request/);
  assert.match(completionPage, /\/api\/auth\/student-activation\/complete/);
  assert.doesNotMatch(requestPage, /\/api\/auth\/register/);
  assert.match(publicShell, /Activate student account/);
});

test("request and completion screens cover neutral, resend, recovery, and success states", async () => {
  const [requestPage, completionPage] = await Promise.all([
    readFile(requestPagePath, "utf8"),
    readFile(completionPagePath, "utf8"),
  ]);

  assert.equal(
    ACTIVATION_REQUEST_SUCCESS_MESSAGE,
    "If the student details match an approved record, an activation email will be sent."
  );
  assert.match(requestPage, /ACTIVATION_REQUEST_SUCCESS_MESSAGE/);
  assert.match(requestPage, /Send another request/);
  assert.match(requestPage, /replaces any earlier unused link/);
  assert.match(completionPage, /ACTIVATION_UNAVAILABLE_MESSAGE/);
  assert.match(completionPage, /Request a new link/);
  assert.match(completionPage, /signIn\(response\.data\)/);
  assert.match(completionPage, /Your student account is ready/);
  assert.match(completionPage, /navigate\(location\.pathname, { replace: true }\)/);
  assert.doesNotMatch(requestPage + completionPage, /localStorage|console\.log/);
});

test("activation forms expose keyboard focus, errors, and mobile touch targets", async () => {
  const [requestPage, completionPage, styles] = await Promise.all([
    readFile(requestPagePath, "utf8"),
    readFile(completionPagePath, "utf8"),
    readFile(activationStylesPath, "utf8"),
  ]);

  assert.match(requestPage, /<form[\s\S]*?noValidate[\s\S]*?onSubmit={submitRequest}/);
  assert.match(completionPage, /<form[\s\S]*?noValidate[\s\S]*?onSubmit={submitPassword}/);
  assert.match(requestPage, /requestAnimationFrame[\s\S]*?\.focus\(\)/);
  assert.match(completionPage, /requestAnimationFrame[\s\S]*?\.focus\(\)/);
  assert.match(requestPage, /role="alert"/);
  assert.match(completionPage, /role="alert"/);
  assert.match(styles, /width:\s*min\(100%, 25rem\)/);
  assert.match(styles, /@media\s*\(max-width:\s*767px\)/);
  assert.match(styles, /min-height:\s*2\.75rem/);
  assert.doesNotMatch(styles, /gradient/i);
});
