import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import {
  createMovementKey,
  getGateActionLabel,
  validateGateCredential,
} from "../src/gate/gateView.js";

const gateStylesPath = fileURLToPath(
  new URL("../src/styles/gate.css", import.meta.url)
);

test("gate credentials accept secure tokens and QR payloads only", () => {
  const token = "A".repeat(43);

  assert.equal(validateGateCredential(token), "");
  assert.equal(validateGateCredential(`hostelmate://gate-pass/${token}`), "");
  assert.match(validateGateCredential("LP-1234"), /43-character/);
});

test("movement retries use bounded unique keys and exact action labels", () => {
  const key = createMovementKey("exit");

  assert.match(key, /^gate-exit-[A-Za-z0-9._:-]{16,}$/);
  assert.ok(key.length <= 100);
  assert.equal(getGateActionLabel("exit"), "Record exit");
  assert.equal(getGateActionLabel("return"), "Record return");
});

test("gate terminal styles retain mobile touch and viewport rules", async () => {
  const styles = await readFile(gateStylesPath, "utf8");

  assert.match(styles, /@media\s*\(max-width:\s*767px\)/);
  assert.match(styles, /hm-gate-result__action[\s\S]*?min-height:\s*3rem/);
  assert.match(styles, /grid-template-columns:\s*minmax\(0, 1fr\)/);
});
