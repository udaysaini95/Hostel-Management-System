import test from "node:test";
import assert from "node:assert/strict";
import {
  STAFF_ROLES,
  USER_ROLES,
  createPublicRegistrationUserValues,
} from "../src/domain/roles.js";

test("public registration always creates a student account", () => {
  const values = createPublicRegistrationUserValues({
    name: "  Ada Lovelace  ",
    email: "  ADA@EXAMPLE.COM  ",
    passwordHash: "hashed-password",
  });

  assert.deepEqual(values, {
    name: "Ada Lovelace",
    email: "ada@example.com",
    password: "hashed-password",
    role: USER_ROLES.STUDENT,
  });
});

for (const attemptedRole of STAFF_ROLES) {
  test(`public registration cannot self-assign the ${attemptedRole} role`, () => {
    const values = createPublicRegistrationUserValues({
      name: "Student User",
      email: "student@example.com",
      passwordHash: "hashed-password",
      role: attemptedRole,
    });

    assert.equal(values.role, USER_ROLES.STUDENT);
    assert.notEqual(values.role, attemptedRole);
  });
}
