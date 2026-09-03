import { readdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { startPostgresTestDatabase } from "../test/support/postgresTestDatabase.js";

const backendDirectory = fileURLToPath(new URL("../", import.meta.url));
const unitTestDirectory = fileURLToPath(new URL("../test", import.meta.url));
const integrationTestDirectory = fileURLToPath(
  new URL("../test/integration", import.meta.url)
);
const supportedModes = new Set(["--all", "--unit", "--integration"]);
const requestedMode = process.argv[2] ?? "--all";

const findTestFiles = async (directory, suffix) => {
  const entries = await readdir(directory, { withFileTypes: true });

  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(suffix))
    .map((entry) => join(directory, entry.name))
    .sort();
};

const runNodeTests = (
  testFiles,
  { environment = process.env, concurrency } = {}
) =>
  new Promise((resolve, reject) => {
    const concurrencyArguments = concurrency
      ? [`--test-concurrency=${concurrency}`]
      : [];
    const child = spawn(
      process.execPath,
      ["--test", ...concurrencyArguments, ...testFiles],
      {
        cwd: backendDirectory,
        env: environment,
        shell: false,
        stdio: "inherit",
      }
    );

    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }

      const reason = signal ? `signal ${signal}` : `exit code ${code}`;
      reject(new Error(`The test process failed with ${reason}.`));
    });
  });

const runUnitTests = async () => {
  const testFiles = await findTestFiles(unitTestDirectory, ".test.js");
  console.log(`Running ${testFiles.length} unit test files...`);
  await runNodeTests(testFiles);
};

const runIntegrationTests = async () => {
  const testFiles = await findTestFiles(
    integrationTestDirectory,
    ".integration.test.js"
  );
  const testDatabase = await startPostgresTestDatabase();

  console.log(
    `Running ${testFiles.length} integration test file against a ${testDatabase.source} PostgreSQL database...`
  );

  try {
    await runNodeTests(testFiles, {
      concurrency: 1,
      environment: {
        ...process.env,
        NODE_ENV: "test",
        DATABASE_URL: testDatabase.url,
        TEST_DATABASE_URL: testDatabase.url,
        JWT_SECRET: "hostelmate-integration-test-secret-only",
        JWT_EXPIRES_IN: "1h",
        CORS_ALLOWED_ORIGINS: "http://localhost:5173",
      },
    });
  } finally {
    await testDatabase.stop();
  }
};

const run = async () => {
  if (!supportedModes.has(requestedMode) || process.argv.length > 3) {
    throw new Error("Use --unit, --integration, or no option for the full suite.");
  }

  if (requestedMode !== "--integration") {
    await runUnitTests();
  }

  if (requestedMode !== "--unit") {
    await runIntegrationTests();
  }
};

run().catch((error) => {
  console.error(`Test run failed: ${error.message}`);
  process.exitCode = 1;
});
