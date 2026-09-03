import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";

const { Pool } = pg;

const backendDirectory = fileURLToPath(new URL("../../", import.meta.url));
const composeFile = fileURLToPath(
  new URL("../../compose.test.yaml", import.meta.url)
);
const developmentEnvironmentFile = fileURLToPath(
  new URL("../../.env", import.meta.url)
);
const testEnvironmentFile = fileURLToPath(
  new URL("../../.env.test", import.meta.url)
);
const migrationsDirectory = fileURLToPath(
  new URL("../../drizzle", import.meta.url)
);

const TEST_DATABASE_NAME_PATTERN = /(^|[-_])test(?:s|ing)?($|[-_])/i;
const TEST_DATABASE_LOCK_NAME = "hostelmate-postgres-integration-tests";
const DOCKER_DATABASE_NAME = "hostelmate_test";
const DOCKER_DATABASE_USER = "hostelmate_test";
const DOCKER_DATABASE_PASSWORD = "hostelmate_test_password";

export class TestDatabaseSafetyError extends Error {
  constructor(message) {
    super(message);
    this.name = "TestDatabaseSafetyError";
  }
}

const parsePostgresUrl = (value, label) => {
  let parsedUrl;

  try {
    parsedUrl = new URL(value);
  } catch {
    throw new TestDatabaseSafetyError(`${label} is not a valid URL.`);
  }

  if (!["postgres:", "postgresql:"].includes(parsedUrl.protocol)) {
    throw new TestDatabaseSafetyError(
      `${label} must use the postgres or postgresql protocol.`
    );
  }

  const databaseName = decodeURIComponent(parsedUrl.pathname.slice(1));

  if (!databaseName || databaseName.includes("/")) {
    throw new TestDatabaseSafetyError(
      `${label} must identify one PostgreSQL database.`
    );
  }

  return { parsedUrl, databaseName };
};

const normalizeDatabaseHost = (hostname) => {
  const normalizedHost = hostname.toLowerCase();

  return ["localhost", "127.0.0.1", "[::1]", "::1"].includes(normalizedHost)
    ? "loopback"
    : normalizedHost;
};

const databaseIdentity = ({ parsedUrl, databaseName }) =>
  [
    normalizeDatabaseHost(parsedUrl.hostname),
    parsedUrl.port || "5432",
    databaseName.toLowerCase(),
  ].join(":");

export const validateTestDatabaseTarget = ({
  testDatabaseUrl,
  developmentDatabaseUrl,
}) => {
  if (!testDatabaseUrl?.trim()) {
    throw new TestDatabaseSafetyError(
      "TEST_DATABASE_URL is required when Docker is not used."
    );
  }

  const testTarget = parsePostgresUrl(
    testDatabaseUrl.trim(),
    "TEST_DATABASE_URL"
  );

  if (!TEST_DATABASE_NAME_PATTERN.test(testTarget.databaseName)) {
    throw new TestDatabaseSafetyError(
      "The TEST_DATABASE_URL database name must contain a separate test segment, such as hostelmate_test."
    );
  }

  if (developmentDatabaseUrl?.trim()) {
    const developmentTarget = parsePostgresUrl(
      developmentDatabaseUrl.trim(),
      "DATABASE_URL"
    );

    if (databaseIdentity(testTarget) === databaseIdentity(developmentTarget)) {
      throw new TestDatabaseSafetyError(
        "TEST_DATABASE_URL must not point to the development database."
      );
    }
  }

  return Object.freeze({
    url: testDatabaseUrl.trim(),
    databaseName: testTarget.databaseName,
  });
};

const runProcess = (command, argumentsList, { captureOutput = false } = {}) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, argumentsList, {
      cwd: backendDirectory,
      shell: false,
      stdio: captureOutput ? ["ignore", "pipe", "pipe"] : "inherit",
    });
    let standardOutput = "";
    let standardError = "";

    if (captureOutput) {
      child.stdout.on("data", (chunk) => {
        standardOutput += chunk;
      });
      child.stderr.on("data", (chunk) => {
        standardError += chunk;
      });
    }

    child.on("error", (error) => {
      reject(error);
    });
    child.on("exit", (code, signal) => {
      if (code === 0) {
        resolve(standardOutput.trim());
        return;
      }

      const reason = signal ? `signal ${signal}` : `exit code ${code}`;
      const details = standardError.trim();
      reject(
        new Error(
          `${command} failed with ${reason}${details ? `: ${details}` : ""}`
        )
      );
    });
  });

const startDockerDatabase = async () => {
  const projectName = `hostelmate-test-${process.pid}-${Date.now().toString(36)}`;
  const composeArguments = [
    "compose",
    "--file",
    composeFile,
    "--project-name",
    projectName,
  ];

  const stop = async () => {
    await runProcess("docker", [
      ...composeArguments,
      "down",
      "--volumes",
      "--remove-orphans",
    ]);
  };

  try {
    await runProcess("docker", [
      ...composeArguments,
      "up",
      "--detach",
      "--wait",
    ]);
    const portOutput = await runProcess(
      "docker",
      [...composeArguments, "port", "database", "5432"],
      { captureOutput: true }
    );
    const port = portOutput.match(/:(\d+)$/)?.[1];

    if (!port) {
      throw new Error("Docker did not report the PostgreSQL test port.");
    }

    const username = encodeURIComponent(DOCKER_DATABASE_USER);
    const password = encodeURIComponent(DOCKER_DATABASE_PASSWORD);

    return {
      url: `postgresql://${username}:${password}@127.0.0.1:${port}/${DOCKER_DATABASE_NAME}`,
      source: "docker",
      stop,
    };
  } catch (error) {
    try {
      await stop();
    } catch {
      // Preserve the startup error because it explains why the test run failed.
    }

    throw new Error(
      `Unable to start the disposable PostgreSQL test database. Start Docker or configure Backend/.env.test. ${error.message}`
    );
  }
};

const readDevelopmentDatabaseUrl = async (environment) => {
  if (environment.DATABASE_URL) {
    return environment.DATABASE_URL;
  }

  try {
    const fileContents = await readFile(developmentEnvironmentFile, "utf8");
    return dotenv.parse(fileContents).DATABASE_URL;
  } catch (error) {
    if (error.code === "ENOENT") {
      return undefined;
    }

    throw error;
  }
};

const resetDatabaseSchemas = async (client) => {
  await client.query("DROP SCHEMA IF EXISTS drizzle CASCADE");
  await client.query("DROP SCHEMA IF EXISTS public CASCADE");
  await client.query("CREATE SCHEMA public");
};

const acquireTestDatabaseLock = async (client) => {
  const result = await client.query(
    "SELECT pg_try_advisory_lock(hashtext($1)) AS acquired",
    [TEST_DATABASE_LOCK_NAME]
  );

  if (!result.rows[0]?.acquired) {
    throw new Error(
      "Another integration test run is already using this test database."
    );
  }
};

const releaseTestDatabaseLock = async (client) => {
  await client.query("SELECT pg_advisory_unlock(hashtext($1))", [
    TEST_DATABASE_LOCK_NAME,
  ]);
};

const loadOptionalTestEnvironment = () => {
  dotenv.config({
    path: testEnvironmentFile,
    override: false,
    quiet: true,
  });
};

export const startPostgresTestDatabase = async () => {
  loadOptionalTestEnvironment();

  const developmentDatabaseUrl = await readDevelopmentDatabaseUrl(process.env);
  let dockerDatabase;
  let testDatabaseUrl = process.env.TEST_DATABASE_URL?.trim();

  if (!testDatabaseUrl) {
    dockerDatabase = await startDockerDatabase();
    testDatabaseUrl = dockerDatabase.url;
  }

  let pool;
  let lockClient;

  try {
    const target = validateTestDatabaseTarget({
      testDatabaseUrl,
      developmentDatabaseUrl,
    });
    pool = new Pool({ connectionString: target.url, max: 2 });
    lockClient = await pool.connect();

    await acquireTestDatabaseLock(lockClient);
    await resetDatabaseSchemas(lockClient);

    const database = drizzle(pool);
    await migrate(database, { migrationsFolder: migrationsDirectory });

    let stopped = false;

    return Object.freeze({
      url: target.url,
      databaseName: target.databaseName,
      source: dockerDatabase?.source ?? "configured",
      stop: async () => {
        if (stopped) {
          return;
        }

        stopped = true;

        try {
          await resetDatabaseSchemas(lockClient);
          await releaseTestDatabaseLock(lockClient);
        } finally {
          lockClient.release();
          await pool.end();
          await dockerDatabase?.stop();
        }
      },
    });
  } catch (error) {
    lockClient?.release();
    await pool?.end();
    await dockerDatabase?.stop();
    throw error;
  }
};
