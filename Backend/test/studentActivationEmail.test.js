import test from "node:test";
import assert from "node:assert/strict";
import {
  parseStudentActivationEmailConfig,
  StudentActivationEmailConfigError,
} from "../src/config/studentActivationEmailConfig.js";
import { buildStudentActivationEmail } from "../src/services/studentActivationEmailService.js";

const EMAIL_ENVIRONMENT = {
  NODE_ENV: "development",
  SMTP_HOST: "smtp.example.test",
  SMTP_PORT: "587",
  SMTP_SECURE: "false",
  SMTP_USER: "mailer",
  SMTP_PASSWORD: "secret",
  EMAIL_FROM: "HostelMate <no-reply@example.test>",
  STUDENT_ACTIVATION_URL: "http://localhost:5173/activate-student",
};

test("student activation email is optional when no SMTP values exist", () => {
  assert.deepEqual(parseStudentActivationEmailConfig({}), { enabled: false });
});

test("student activation email configuration accepts provider-neutral SMTP", () => {
  const config = parseStudentActivationEmailConfig(EMAIL_ENVIRONMENT);

  assert.equal(config.enabled, true);
  assert.equal(config.host, "smtp.example.test");
  assert.equal(config.port, 587);
  assert.equal(config.secure, false);
  assert.equal(config.user, "mailer");
  assert.equal(config.activationUrl, "http://localhost:5173/activate-student");
});

test("partial SMTP configuration fails instead of silently dropping email", () => {
  assert.throws(
    () => parseStudentActivationEmailConfig({ SMTP_HOST: "smtp.example.test" }),
    StudentActivationEmailConfigError
  );
});

test("production activation links require HTTPS", () => {
  assert.throws(
    () =>
      parseStudentActivationEmailConfig({
        ...EMAIL_ENVIRONMENT,
        NODE_ENV: "production",
      }),
    /must use HTTPS in production/
  );
});

test("activation email places the token only in the activation URL", () => {
  const config = parseStudentActivationEmailConfig(EMAIL_ENVIRONMENT);
  const message = buildStudentActivationEmail(config, {
    name: "Asha Rao",
    email: "asha.rao@college.edu",
    token: "student-activation-token",
  });

  assert.equal(message.to, "asha.rao@college.edu");
  assert.doesNotMatch(message.subject, /student-activation-token/);
  assert.match(
    message.text,
    /activate-student\?token=student-activation-token/
  );
});
