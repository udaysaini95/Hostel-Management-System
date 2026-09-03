import test from "node:test";
import assert from "node:assert/strict";

process.env.DATABASE_URL =
  "postgresql://hostelmate:secret@db.example.test:5432/hostelmate";
process.env.JWT_SECRET = "test-secret-with-at-least-32-characters";

const { register } = await import("../src/Controllers/authController.js");

const createResponse = () => ({
  statusCode: null,
  body: null,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(body) {
    this.body = body;
    return this;
  },
});

test("open registration directs every caller to approved activation", () => {
  const response = createResponse();

  register(
    {
      body: {
        name: "Unapproved User",
        email: "student@example.com",
        password: "not-used-here",
        role: "admin",
      },
    },
    response
  );

  assert.equal(response.statusCode, 410);
  assert.deepEqual(response.body, {
    code: "STUDENT_ACTIVATION_REQUIRED",
    message: "Students must activate an administrator-approved record",
  });
});
