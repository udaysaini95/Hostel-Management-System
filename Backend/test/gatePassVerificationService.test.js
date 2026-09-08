import test from "node:test";
import assert from "node:assert/strict";
import {
  GATE_ACTIONS,
  PASS_VERIFICATION_CODES,
  evaluateGatePass,
  normalizeGatePassCredential,
} from "../src/services/gatePassVerificationService.js";
import { ACCOUNT_STATUSES } from "../src/domain/accountStatuses.js";

const token = "A".repeat(43);
const activePass = {
  leaveStatus: "approved",
  validFrom: new Date("2026-11-10T08:00:00.000Z"),
  expiresAt: new Date("2026-11-11T18:00:00.000Z"),
  revokedAt: null,
  studentAccountStatus: ACCOUNT_STATUSES.ACTIVE,
  hostelIsActive: true,
};

test("gate-pass credentials distinguish QR scans from controlled manual entry", () => {
  const manual = normalizeGatePassCredential(token);
  const qr = normalizeGatePassCredential(`hostelmate://gate-pass/${token}`);

  assert.equal(manual.verificationMethod, "manual");
  assert.equal(qr.verificationMethod, "qr");
  assert.equal(manual.tokenHash, qr.tokenHash);
  assert.match(manual.tokenHash, /^[a-f0-9]{64}$/);
  assert.equal(normalizeGatePassCredential("LP-1234"), null);
  assert.equal(normalizeGatePassCredential(`${token}extra`), null);
});

test("an approved or exited pass receives exactly one permitted action", () => {
  const now = new Date("2026-11-10T10:00:00.000Z");
  const approved = evaluateGatePass(activePass, now);
  const exited = evaluateGatePass({ ...activePass, leaveStatus: "exited" }, now);

  assert.equal(approved.valid, true);
  assert.equal(approved.permittedAction, GATE_ACTIONS.EXIT);
  assert.equal(exited.valid, true);
  assert.equal(exited.permittedAction, GATE_ACTIONS.RETURN);
  assert.equal("canExit" in approved, false);
  assert.equal("canReturn" in approved, false);
});

test("time, revocation, and terminal state checks deny every gate action", () => {
  const cases = [
    {
      record: activePass,
      now: new Date("2026-11-10T07:59:59.000Z"),
      code: PASS_VERIFICATION_CODES.NOT_YET_VALID,
    },
    {
      record: activePass,
      now: new Date("2026-11-11T18:00:00.000Z"),
      code: PASS_VERIFICATION_CODES.EXPIRED,
    },
    {
      record: { ...activePass, revokedAt: new Date("2026-11-10T09:00:00Z") },
      now: new Date("2026-11-10T10:00:00.000Z"),
      code: PASS_VERIFICATION_CODES.REVOKED,
    },
    {
      record: { ...activePass, leaveStatus: "rejected" },
      now: new Date("2026-11-10T10:00:00.000Z"),
      code: PASS_VERIFICATION_CODES.REJECTED,
    },
    {
      record: { ...activePass, leaveStatus: "returned" },
      now: new Date("2026-11-10T10:00:00.000Z"),
      code: PASS_VERIFICATION_CODES.COMPLETED,
    },
  ];

  for (const item of cases) {
    const result = evaluateGatePass(item.record, item.now);
    assert.equal(result.valid, false);
    assert.equal(result.code, item.code);
    assert.equal(result.permittedAction, null);
  }
});
