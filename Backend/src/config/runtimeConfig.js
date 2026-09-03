import "dotenv/config";

export const JWT_SECRET_MIN_LENGTH = 32;
export const DEFAULT_JWT_EXPIRES_IN = "1h";
export const MAX_JWT_LIFETIME_SECONDS = 24 * 60 * 60;
export const DEFAULT_PORT = 5000;
export const DEFAULT_TRUST_PROXY_HOPS = 0;
export const DEFAULT_CORS_ALLOWED_ORIGINS = Object.freeze([
  "http://localhost:5173",
  "http://127.0.0.1:5173",
]);

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

const JWT_DURATION_MULTIPLIERS = Object.freeze({
  s: 1,
  m: 60,
  h: 60 * 60,
  d: 24 * 60 * 60,
});

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

const parseJwtExpiration = (value, issues) => {
  const expiration = value || DEFAULT_JWT_EXPIRES_IN;
  const match = /^(\d+)([smhd])$/.exec(expiration);

  if (!match || Number(match[1]) < 1) {
    issues.push(
      "JWT_EXPIRES_IN must use a positive duration such as 15m, 1h, or 1d."
    );
    return null;
  }

  const lifetimeSeconds =
    Number(match[1]) * JWT_DURATION_MULTIPLIERS[match[2]];

  if (
    !Number.isSafeInteger(lifetimeSeconds) ||
    lifetimeSeconds > MAX_JWT_LIFETIME_SECONDS
  ) {
    issues.push("JWT_EXPIRES_IN cannot exceed 24 hours.");
    return null;
  }

  return expiration;
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

const parseCorsAllowedOrigins = (value, nodeEnvironment, issues) => {
  const configuredOrigins = value
    ?.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (!configuredOrigins?.length) {
    if (nodeEnvironment === "production") {
      issues.push("CORS_ALLOWED_ORIGINS is required in production.");
      return Object.freeze([]);
    }

    return DEFAULT_CORS_ALLOWED_ORIGINS;
  }

  const normalizedOrigins = new Set();

  for (const origin of configuredOrigins) {
    try {
      const url = new URL(origin);
      const hasUnsupportedParts =
        !["http:", "https:"].includes(url.protocol) ||
        url.pathname !== "/" ||
        Boolean(url.search || url.hash || url.username || url.password);

      if (hasUnsupportedParts) {
        throw new Error("Origin must contain only a protocol, host, and port");
      }

      normalizedOrigins.add(url.origin);
    } catch {
      issues.push("CORS_ALLOWED_ORIGINS contains an invalid origin.");
    }
  }

  return Object.freeze([...normalizedOrigins]);
};

const parseTrustProxyHops = (value, issues) => {
  if (value === undefined || value === "") {
    return DEFAULT_TRUST_PROXY_HOPS;
  }

  const hops = Number(value);

  if (!Number.isInteger(hops) || hops < 0 || hops > 2) {
    issues.push("TRUST_PROXY_HOPS must be an integer from 0 through 2.");
    return null;
  }

  return hops;
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
  const jwtExpiresIn = parseJwtExpiration(environment.JWT_EXPIRES_IN, issues);
  const port = parsePort(environment.PORT, issues);
  const nodeEnvironment = parseNodeEnvironment(environment.NODE_ENV, issues);
  const corsAllowedOrigins = parseCorsAllowedOrigins(
    environment.CORS_ALLOWED_ORIGINS,
    nodeEnvironment,
    issues
  );
  const trustProxyHops = parseTrustProxyHops(
    environment.TRUST_PROXY_HOPS,
    issues
  );

  if (issues.length > 0) {
    throw new ConfigurationError(issues);
  }

  return Object.freeze({
    databaseUrl,
    jwtSecret,
    jwtExpiresIn,
    port,
    nodeEnvironment,
    corsAllowedOrigins,
    trustProxyHops,
  });
};

let cachedRuntimeConfig;

export const getRuntimeConfig = () => {
  if (!cachedRuntimeConfig) {
    cachedRuntimeConfig = parseRuntimeConfig(process.env);
  }

  return cachedRuntimeConfig;
};
