import test from "node:test";
import assert from "node:assert/strict";
import {
  ACCOUNT_STATUSES,
  canStartSession,
} from "../src/domain/accountStatuses.js";

test("only active accounts may start authenticated sessions", () => {
  assert.equal(canStartSession(ACCOUNT_STATUSES.ACTIVE), true);
  assert.equal(canStartSession(ACCOUNT_STATUSES.PENDING), false);
  assert.equal(canStartSession(ACCOUNT_STATUSES.SUSPENDED), false);
  assert.equal(canStartSession(undefined), false);
  assert.equal(canStartSession("unknown"), false);
});
