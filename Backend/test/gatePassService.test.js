import test from "node:test";
import assert from "node:assert/strict";
import {
  renderGatePassPdf,
  renderGatePassQr,
} from "../src/services/gatePassService.js";

const leaveRequest = {
  studentName: "Asha Mehta",
  studentRollNo: "HM-101",
  hostelName: "Horizon Hostel",
  hostelCode: "H1",
  reason: "Attending a family function",
};

test("gate pass renderers create valid PNG and PDF buffers", async () => {
  const token = "test-token-that-is-never-written-to-the-database";
  const qrBuffer = await renderGatePassQr(`hostelmate://gate-pass/${token}`);
  const pdfBuffer = await renderGatePassPdf({
    leaveRequest,
    token,
    qrBuffer,
    validFrom: new Date("2026-11-10T08:00:00.000Z"),
    expiresAt: new Date("2026-11-11T18:00:00.000Z"),
  });

  assert.deepEqual([...qrBuffer.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.equal(pdfBuffer.subarray(0, 4).toString(), "%PDF");
  assert.ok(qrBuffer.length > 500);
  assert.ok(pdfBuffer.length > 1_000);
});
