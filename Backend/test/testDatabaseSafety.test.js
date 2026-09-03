import test from "node:test";
import assert from "node:assert/strict";
import {
  TestDatabaseSafetyError,
  validateTestDatabaseTarget,
} from "./support/postgresTestDatabase.js";

test("test database validation accepts a clearly named test database", () => {
  const target = validateTestDatabaseTarget({
    testDatabaseUrl:
      "postgresql://tester:password@127.0.0.1:5432/hostelmate_test",
    developmentDatabaseUrl:
      "postgresql://developer:password@127.0.0.1:5432/hostelmate_dev",
  });

  assert.equal(target.databaseName, "hostelmate_test");
});

test("test database validation never falls back to a development URL", () => {
  assert.throws(
    () =>
      validateTestDatabaseTarget({
        developmentDatabaseUrl:
          "postgresql://developer:password@localhost:5432/hostelmate_dev",
      }),
    (error) =>
      error instanceof TestDatabaseSafetyError &&
      /TEST_DATABASE_URL is required/.test(error.message)
  );
});

test("test database validation rejects ordinary database names", () => {
  assert.throws(
    () =>
      validateTestDatabaseTarget({
        testDatabaseUrl:
          "postgresql://tester:password@localhost:5432/hostelmate",
      }),
    (error) =>
      error instanceof TestDatabaseSafetyError &&
      /separate test segment/.test(error.message)
  );
});

test("test database validation rejects the configured development database", () => {
  assert.throws(
    () =>
      validateTestDatabaseTarget({
        testDatabaseUrl:
          "postgresql://test_user:test_password@db.example.test:5432/hostelmate_test?sslmode=require",
        developmentDatabaseUrl:
          "postgresql://app_user:app_password@DB.EXAMPLE.TEST/hostelmate_test",
      }),
    (error) =>
      error instanceof TestDatabaseSafetyError &&
      /must not point to the development database/.test(error.message)
  );
});

test("loopback aliases cannot bypass the development database check", () => {
  assert.throws(
    () =>
      validateTestDatabaseTarget({
        testDatabaseUrl:
          "postgresql://tester:password@127.0.0.1:5432/hostelmate_test",
        developmentDatabaseUrl:
          "postgresql://developer:password@localhost/hostelmate_test",
      }),
    (error) =>
      error instanceof TestDatabaseSafetyError &&
      /must not point to the development database/.test(error.message)
  );
});

test("test database validation does not reveal credentials in errors", () => {
  const secretPassword = "do-not-print-this-password";

  assert.throws(
    () =>
      validateTestDatabaseTarget({
        testDatabaseUrl: `https://tester:${secretPassword}@localhost/hostelmate_test`,
      }),
    (error) => !error.message.includes(secretPassword)
  );
});
