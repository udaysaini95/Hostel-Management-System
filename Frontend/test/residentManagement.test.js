import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import {
  getAccountStatusLabel,
  getAccountStatusTone,
  getStudentContactPayload,
  normalizeResidentFilters,
  normalizeRoomFilters,
  validateStudentContact,
} from "../src/residents/residentView.js";

const managementPagePath = fileURLToPath(
  new URL("../src/pages/ResidentRoomManagement.jsx", import.meta.url)
);
const directoryPath = fileURLToPath(
  new URL("../src/residents/ResidentDirectory.jsx", import.meta.url)
);
const allocationDialogPath = fileURLToPath(
  new URL("../src/residents/RoomAllocationDialog.jsx", import.meta.url)
);
const profilePagePath = fileURLToPath(
  new URL("../src/pages/StudentProfile.jsx", import.meta.url)
);
const stylesPath = fileURLToPath(
  new URL("../src/styles/residents.css", import.meta.url)
);

test("student contact validation matches the backend profile boundaries", () => {
  assert.deepEqual(
    validateStudentContact({
      phone: "123",
      guardianName: " ",
      guardianPhone: "invalid",
    }),
    {
      phone: "Enter a valid phone number using 7 to 20 characters.",
      guardianName: "Enter the guardian's name.",
      guardianPhone:
        "Enter a valid guardian phone number using 7 to 20 characters.",
    }
  );
  assert.deepEqual(
    getStudentContactPayload({
      phone: " +91 98765 43210 ",
      guardianName: " Anita Rao ",
      guardianPhone: " +91 98765 43211 ",
    }),
    {
      phone: "+91 98765 43210",
      guardianName: "Anita Rao",
      guardianPhone: "+91 98765 43211",
    }
  );
});

test("resident filters normalize identifiers without changing account state", () => {
  assert.deepEqual(
    normalizeResidentFilters({
      search: " kavya ",
      hostelCode: " h1 ",
      blockCode: " a ",
      roomNumber: " 101a ",
      accountStatus: "active",
    }),
    {
      search: "kavya",
      hostelCode: "H1",
      blockCode: "A",
      roomNumber: "101A",
      accountStatus: "active",
    }
  );
  assert.deepEqual(
    normalizeRoomFilters({
      hostelCode: " h2 ",
      blockCode: " b ",
      availability: "available",
    }),
    { hostelCode: "H2", blockCode: "B", availability: "available" }
  );
});

test("account states use stable labels and semantic tones", () => {
  assert.equal(getAccountStatusLabel("active"), "Active");
  assert.equal(getAccountStatusTone("active"), "success");
  assert.equal(getAccountStatusTone("pending"), "warning");
  assert.equal(getAccountStatusTone("suspended"), "danger");
  assert.equal(getAccountStatusLabel("unexpected"), "Unknown");
});

test("resident screens use live APIs, dialogs, and responsive list alternatives", async () => {
  const [managementPage, directory, allocationDialog, profilePage, styles] =
    await Promise.all([
      readFile(managementPagePath, "utf8"),
      readFile(directoryPath, "utf8"),
      readFile(allocationDialogPath, "utf8"),
      readFile(profilePagePath, "utf8"),
      readFile(stylesPath, "utf8"),
    ]);

  assert.match(directory, /api\.get\("\/api\/residents"/);
  assert.match(allocationDialog, /api\.get\("\/api\/rooms"/);
  assert.match(allocationDialog, /api\.post\("\/api\/room-allocations"/);
  assert.match(managementPage, /\/vacate`/);
  assert.match(managementPage, /<ConfirmationDialog/);
  assert.match(profilePage, /api\.get\("\/api\/student\/profile"/);
  assert.match(profilePage, /api\.patch\(/);
  assert.match(directory, /hm-residents__mobile-list/);
  assert.match(styles, /@media\s*\(max-width:\s*767px\)/);
  assert.match(
    styles,
    /\.hm-residents__desktop-list\s*\{[\s\S]*?display:\s*none/
  );
  assert.doesNotMatch(
    `${managementPage}${directory}${allocationDialog}${profilePage}`,
    /localhost|window\.alert|window\.confirm/
  );
});
