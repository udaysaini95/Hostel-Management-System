import test from "node:test";
import assert from "node:assert/strict";
import {
  ConfigurationError,
  DEFAULT_JWT_EXPIRES_IN,
  DEFAULT_PORT,
  JWT_SECRET_MIN_LENGTH,
  parseRuntimeConfig,
  requireDatabaseUrl,
} from "../src/config/runtimeConfig.js";

const VALID_DATABASE_URL =
  "postgresql://hostelmate:secret@db.example.test:5432/hostelmate";
const VALID_JWT_SECRET = "a".repeat(JWT_SECRET_MIN_LENGTH);

test("runtime configuration parses valid values", () => {
  const config = parseRuntimeConfig({
    DATABASE_URL: VALID_DATABASE_URL,
    JWT_SECRET: VALID_JWT_SECRET,
    PORT: "4100",
    NODE_ENV: "test",
  });

  assert.deepEqual(config, {
    databaseUrl: VALID_DATABASE_URL,
    jwtSecret: VALID_JWT_SECRET,
    jwtExpiresIn: DEFAULT_JWT_EXPIRES_IN,
    port: 4100,
    nodeEnvironment: "test",
  });
  assert.equal(Object.isFrozen(config), true);
});

test("runtime configuration applies safe non-secret defaults", () => {
  const config = parseRuntimeConfig({
    DATABASE_URL: VALID_DATABASE_URL,
    JWT_SECRET: VALID_JWT_SECRET,
  });

  assert.equal(config.port, DEFAULT_PORT);
  assert.equal(config.nodeEnvironment, "development");
  assert.equal(config.jwtExpiresIn, DEFAULT_JWT_EXPIRES_IN);
});

test("runtime configuration reports all missing required credentials", () => {
  assert.throws(
    () => parseRuntimeConfig({}),
    (error) => {
      assert.ok(error instanceof ConfigurationError);
      assert.match(error.message, /DATABASE_URL is required/);
      assert.match(error.message, /JWT_SECRET is required/);
      assert.equal(error.issues.length, 2);
      return true;
    }
  );
});

test("runtime configuration rejects placeholder and weak credentials", () => {
  const weakSecret = "too-short";

  assert.throws(
    () =>
      parseRuntimeConfig({
        DATABASE_URL:
          "postgresql://owner:your_neon_password@ep-your-neon-host/neondb",
        JWT_SECRET: weakSecret,
      }),
    (error) => {
      assert.match(error.message, /example placeholder values/);
      assert.match(error.message, /at least 32 characters/);
      assert.doesNotMatch(error.message, new RegExp(weakSecret));
      return true;
    }
  );
});

test("runtime configuration validates database protocol, port, and environment", () => {
  assert.throws(
    () =>
      parseRuntimeConfig({
        DATABASE_URL: "https://db.example.test/hostelmate",
        JWT_SECRET: VALID_JWT_SECRET,
        PORT: "70000",
        NODE_ENV: "staging",
      }),
    (error) => {
      assert.match(error.message, /postgres or postgresql protocol/);
      assert.match(error.message, /integer between 1 and 65535/);
      assert.match(error.message, /development, test, or production/);
      return true;
    }
  );
});

test("runtime configuration limits access-session lifetime", () => {
  const validConfig = parseRuntimeConfig({
    DATABASE_URL: VALID_DATABASE_URL,
    JWT_SECRET: VALID_JWT_SECRET,
    JWT_EXPIRES_IN: "15m",
  });

  assert.equal(validConfig.jwtExpiresIn, "15m");
  assert.throws(
    () =>
      parseRuntimeConfig({
        DATABASE_URL: VALID_DATABASE_URL,
        JWT_SECRET: VALID_JWT_SECRET,
        JWT_EXPIRES_IN: "0h",
      }),
    /positive duration/
  );
  assert.throws(
    () =>
      parseRuntimeConfig({
        DATABASE_URL: VALID_DATABASE_URL,
        JWT_SECRET: VALID_JWT_SECRET,
        JWT_EXPIRES_IN: "25h",
      }),
    /cannot exceed 24 hours/
  );
});

test("database-only utilities validate DATABASE_URL without requiring JWT_SECRET", () => {
  assert.equal(
    requireDatabaseUrl({ DATABASE_URL: VALID_DATABASE_URL }),
    VALID_DATABASE_URL
  );
  assert.throws(() => requireDatabaseUrl({}), /DATABASE_URL is required/);
});
