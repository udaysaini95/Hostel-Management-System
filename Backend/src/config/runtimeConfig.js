import "dotenv/config";

export const JWT_SECRET_MIN_LENGTH = 32;
export const DEFAULT_PORT = 5000;

const ALLOWED_NODE_ENVIRONMENTS = new Set([
  "development",
  "test",
  "production",
]);

const DATABASE_PLACEHOLDER_FRAGMENTS = [
  "your_neon_password",
  "ep-your-neon-host",
  "user:password@localhost",
];

const JWT_PLACEHOLDER_VALUES = new Set([
  "your_jwt_secret_key_here",
]);

export class ConfigurationError extends Error {
  constructor(issues) {
    super(`Invalid runtime configuration:\n- ${issues.join("\n- ")}`);
    this.name = "ConfigurationError";
    this.issues = Object.freeze([...issues]);
  }
}

const parseDatabaseUrl = (value, issues) => {
  if (!value) {
    issues.push("DATABASE_URL is required.");
    return null;
  }

  if (DATABASE_PLACEHOLDER_FRAGMENTS.some((fragment) => value.includes(fragment))) {
    issues.push("DATABASE_URL still contains example placeholder values.");
    return null;
  }

  try {
    const parsedUrl = new URL(value);

    if (!["postgres:", "postgresql:"].includes(parsedUrl.protocol)) {
      issues.push("DATABASE_URL must use the postgres or postgresql protocol.");
      return null;
    }

    return value;
  } catch {
    issues.push("DATABASE_URL must be a valid PostgreSQL connection URL.");
    return null;
  }
};

const parseJwtSecret = (value, issues) => {
  if (!value) {
    issues.push("JWT_SECRET is required.");
    return null;
  }

  if (
    value.trim().length < JWT_SECRET_MIN_LENGTH ||
    JWT_PLACEHOLDER_VALUES.has(value)
  ) {
    issues.push(
      `JWT_SECRET must be a non-placeholder value of at least ${JWT_SECRET_MIN_LENGTH} characters.`
    );
    return null;
  }

  return value;
};

const parsePort = (value, issues) => {
  if (value === undefined || value === "") {
    return DEFAULT_PORT;
  }

  const port = Number(value);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    issues.push("PORT must be an integer between 1 and 65535.");
    return null;
  }

  return port;
};

const parseNodeEnvironment = (value, issues) => {
  const nodeEnvironment = value || "development";

  if (!ALLOWED_NODE_ENVIRONMENTS.has(nodeEnvironment)) {
    issues.push("NODE_ENV must be development, test, or production.");
    return null;
  }

  return nodeEnvironment;
};

export const requireDatabaseUrl = (environment = process.env) => {
  const issues = [];
  const databaseUrl = parseDatabaseUrl(environment.DATABASE_URL, issues);

  if (issues.length > 0) {
    throw new ConfigurationError(issues);
  }

  return databaseUrl;
};

export const parseRuntimeConfig = (environment = process.env) => {
  const issues = [];
  const databaseUrl = parseDatabaseUrl(environment.DATABASE_URL, issues);
  const jwtSecret = parseJwtSecret(environment.JWT_SECRET, issues);
  const port = parsePort(environment.PORT, issues);
  const nodeEnvironment = parseNodeEnvironment(environment.NODE_ENV, issues);

  if (issues.length > 0) {
    throw new ConfigurationError(issues);
  }

  return Object.freeze({
    databaseUrl,
    jwtSecret,
    port,
    nodeEnvironment,
  });
};

let cachedRuntimeConfig;

export const getRuntimeConfig = () => {
  if (!cachedRuntimeConfig) {
    cachedRuntimeConfig = parseRuntimeConfig(process.env);
  }

  return cachedRuntimeConfig;
};
