import { randomUUID } from "node:crypto";
import jwt from "jsonwebtoken";
import { getRuntimeConfig } from "../config/runtimeConfig.js";
import { USER_ROLES } from "../domain/roles.js";

export const ACCESS_TOKEN_ISSUER = "hostelmate-api";
export const ACCESS_TOKEN_AUDIENCE = "hostelmate-web";
export const ACCESS_TOKEN_TYPE = "access";
export const ACCESS_TOKEN_ALGORITHM = "HS256";

const supportedRoles = new Set(Object.values(USER_ROLES));

const assertSessionUser = (user) => {
  const userId = Number(user?.id);

  if (!Number.isSafeInteger(userId) || userId < 1) {
    throw new Error("A valid user ID is required to create an access session.");
  }

  if (!supportedRoles.has(user?.role)) {
    throw new Error("A supported user role is required to create an access session.");
  }

  if (typeof user?.email !== "string" || user.email.length === 0) {
    throw new Error("A user email is required to create an access session.");
  }

  return userId;
};

const assertAccessTokenClaims = (payload) => {
  const userId = Number(payload?.sub);

  if (
    !payload ||
    typeof payload === "string" ||
    payload.tokenType !== ACCESS_TOKEN_TYPE ||
    !Number.isSafeInteger(userId) ||
    userId < 1 ||
    !supportedRoles.has(payload.role) ||
    typeof payload.email !== "string" ||
    payload.email.length === 0 ||
    typeof payload.jti !== "string" ||
    typeof payload.iat !== "number" ||
    typeof payload.exp !== "number" ||
    payload.exp <= payload.iat
  ) {
    throw new Error("Invalid access token claims.");
  }

  return Object.freeze({
    id: userId,
    role: payload.role,
    email: payload.email,
    sessionId: payload.jti,
    issuedAt: payload.iat,
    expiresAt: payload.exp,
  });
};

export const createAccessSession = (user, config = getRuntimeConfig()) => {
  const userId = assertSessionUser(user);
  const token = jwt.sign(
    {
      role: user.role,
      email: user.email,
      tokenType: ACCESS_TOKEN_TYPE,
    },
    config.jwtSecret,
    {
      algorithm: ACCESS_TOKEN_ALGORITHM,
      audience: ACCESS_TOKEN_AUDIENCE,
      expiresIn: config.jwtExpiresIn,
      issuer: ACCESS_TOKEN_ISSUER,
      jwtid: randomUUID(),
      subject: String(userId),
    }
  );

  return Object.freeze({
    token,
    tokenType: "Bearer",
    expiresIn: config.jwtExpiresIn,
  });
};

export const verifyAccessToken = (token, config = getRuntimeConfig()) => {
  const payload = jwt.verify(token, config.jwtSecret, {
    algorithms: [ACCESS_TOKEN_ALGORITHM],
    audience: ACCESS_TOKEN_AUDIENCE,
    issuer: ACCESS_TOKEN_ISSUER,
  });

  return assertAccessTokenClaims(payload);
};

export const isExpiredAccessTokenError = (error) =>
  error?.name === "TokenExpiredError";
