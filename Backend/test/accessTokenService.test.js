import test from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { USER_ROLES } from "../src/domain/roles.js";
import {
  ACCESS_TOKEN_ALGORITHM,
  ACCESS_TOKEN_AUDIENCE,
  ACCESS_TOKEN_ISSUER,
  ACCESS_TOKEN_TYPE,
  createAccessSession,
  isExpiredAccessTokenError,
  verifyAccessToken,
} from "../src/services/accessTokenService.js";

const TOKEN_CONFIG = Object.freeze({
  jwtSecret: "test-secret-with-at-least-32-characters",
  jwtExpiresIn: "1h",
});

const TEST_USER = Object.freeze({
  id: 42,
  email: "student.h1@hostelmate.example",
  role: USER_ROLES.STUDENT,
});

const signFixtureToken = (payload, options = {}) =>
  jwt.sign(payload, TOKEN_CONFIG.jwtSecret, {
    algorithm: ACCESS_TOKEN_ALGORITHM,
    audience: ACCESS_TOKEN_AUDIENCE,
    expiresIn: "1h",
    issuer: ACCESS_TOKEN_ISSUER,
    jwtid: "fixture-session-id",
    subject: String(TEST_USER.id),
    ...options,
  });

test("access sessions contain standardized expiring claims", () => {
  const session = createAccessSession(TEST_USER, TOKEN_CONFIG);
  const decoded = jwt.decode(session.token);
  const authenticatedUser = verifyAccessToken(session.token, TOKEN_CONFIG);

  assert.equal(session.tokenType, "Bearer");
  assert.equal(session.expiresIn, "1h");
  assert.equal(decoded.sub, String(TEST_USER.id));
  assert.equal(decoded.role, TEST_USER.role);
  assert.equal(decoded.email, TEST_USER.email);
  assert.equal(decoded.tokenType, ACCESS_TOKEN_TYPE);
  assert.equal(decoded.iss, ACCESS_TOKEN_ISSUER);
  assert.equal(decoded.aud, ACCESS_TOKEN_AUDIENCE);
  assert.equal(decoded.exp - decoded.iat, 60 * 60);
  assert.match(decoded.jti, /^[0-9a-f-]{36}$/);
  assert.deepEqual(authenticatedUser, {
    id: TEST_USER.id,
    role: TEST_USER.role,
    email: TEST_USER.email,
    sessionId: decoded.jti,
    issuedAt: decoded.iat,
    expiresAt: decoded.exp,
  });
});

test("expired access sessions are rejected distinctly", () => {
  const expiredToken = signFixtureToken(
    {
      role: TEST_USER.role,
      email: TEST_USER.email,
      tokenType: ACCESS_TOKEN_TYPE,
    },
    { expiresIn: -1 }
  );

  assert.throws(
    () => verifyAccessToken(expiredToken, TOKEN_CONFIG),
    (error) => {
      assert.equal(isExpiredAccessTokenError(error), true);
      return true;
    }
  );
});

test("malformed and incorrectly signed access tokens are rejected", () => {
  assert.throws(
    () => verifyAccessToken("not-a-jwt", TOKEN_CONFIG),
    /jwt malformed/
  );

  const wrongSecretToken = jwt.sign(
    {
      role: TEST_USER.role,
      email: TEST_USER.email,
      tokenType: ACCESS_TOKEN_TYPE,
    },
    "different-secret-with-at-least-32-characters",
    {
      algorithm: ACCESS_TOKEN_ALGORITHM,
      audience: ACCESS_TOKEN_AUDIENCE,
      expiresIn: "1h",
      issuer: ACCESS_TOKEN_ISSUER,
      jwtid: "wrong-secret-session",
      subject: String(TEST_USER.id),
    }
  );

  assert.throws(
    () => verifyAccessToken(wrongSecretToken, TOKEN_CONFIG),
    /invalid signature/
  );
});

test("client-side role tampering invalidates the token signature", () => {
  const session = createAccessSession(TEST_USER, TOKEN_CONFIG);
  const [header, encodedPayload, signature] = session.token.split(".");
  const payload = JSON.parse(
    Buffer.from(encodedPayload, "base64url").toString("utf8")
  );
  payload.role = USER_ROLES.ADMIN;

  const tamperedToken = [
    header,
    Buffer.from(JSON.stringify(payload)).toString("base64url"),
    signature,
  ].join(".");

  assert.throws(
    () => verifyAccessToken(tamperedToken, TOKEN_CONFIG),
    /invalid signature/
  );
});

test("signed tokens with unsupported roles or token types are rejected", () => {
  const unsupportedRoleToken = signFixtureToken({
    role: "superadmin",
    email: TEST_USER.email,
    tokenType: ACCESS_TOKEN_TYPE,
  });
  const wrongTypeToken = signFixtureToken({
    role: TEST_USER.role,
    email: TEST_USER.email,
    tokenType: "password-reset",
  });

  assert.throws(
    () => verifyAccessToken(unsupportedRoleToken, TOKEN_CONFIG),
    /Invalid access token claims/
  );
  assert.throws(
    () => verifyAccessToken(wrongTypeToken, TOKEN_CONFIG),
    /Invalid access token claims/
  );
});

test("access sessions reject invalid user identities before signing", () => {
  assert.throws(
    () => createAccessSession({ ...TEST_USER, id: 0 }, TOKEN_CONFIG),
    /valid user ID/
  );
  assert.throws(
    () => createAccessSession({ ...TEST_USER, role: "superadmin" }, TOKEN_CONFIG),
    /supported user role/
  );
});
