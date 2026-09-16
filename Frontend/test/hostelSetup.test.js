import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import {
  getResidentTypeLabel,
  getStudentHousingLabel,
  isHousingCompatible,
  validateBlockForm,
  validateHostelForm,
  validateRoomForm,
} from "../src/hostels/hostelView.js";

const pagePath = fileURLToPath(
  new URL("../src/pages/HostelSetup.jsx", import.meta.url)
);
const inventoryPath = fileURLToPath(
  new URL("../src/hostels/HostelInventoryManager.jsx", import.meta.url)
);

test("hostel labels use clear campus language", () => {
  assert.equal(getResidentTypeLabel("boys"), "Boys hostel");
  assert.equal(getResidentTypeLabel("girls"), "Girls hostel");
  assert.equal(getResidentTypeLabel("co_ed"), "Co-ed hostel");
});

test("student housing helpers allow matching and co-ed assignments", () => {
  assert.equal(getStudentHousingLabel("girls"), "Girls housing");
  assert.equal(getStudentHousingLabel(null), "Not recorded");
  assert.equal(isHousingCompatible("girls", "girls"), true);
  assert.equal(isHousingCompatible("girls", "co_ed"), true);
  assert.equal(isHousingCompatible("girls", "boys"), false);
});

test("hostel form validates code, name, type, and address", () => {
  assert.deepEqual(
    validateHostelForm({
      code: "GH1",
      name: "Gargi Residence",
      residentType: "girls",
      address: "East campus",
    }),
    {}
  );

  const errors = validateHostelForm({
    code: "girls hostel",
    name: "",
    residentType: "unknown",
    address: "x".repeat(1001),
  });
  assert.deepEqual(Object.keys(errors), [
    "code",
    "name",
    "residentType",
    "address",
  ]);
});

test("block and room forms enforce normalized inventory limits", () => {
  assert.deepEqual(validateBlockForm({ code: "A", name: "Ashoka Block" }), {});
  assert.deepEqual(
    validateRoomForm({ roomNumber: "101-A", floor: "1", capacity: "3" }),
    {}
  );
  assert.deepEqual(
    Object.keys(validateRoomForm({ roomNumber: "?", floor: "-1", capacity: "21" })),
    ["roomNumber", "floor", "capacity"]
  );
});

test("hostel setup provides loading, empty, error, and confirmation states", async () => {
  const [source, inventory] = await Promise.all([
    readFile(pagePath, "utf8"),
    readFile(inventoryPath, "utf8"),
  ]);
  assert.match(source, /<LoadingState/);
  assert.match(source, /<EmptyState/);
  assert.match(source, /<ErrorState/);
  assert.match(source, /<ConfirmationDialog/);
  assert.match(source, /Deactivation is blocked/);
  assert.match(source, /<HostelInventoryManager/);
  assert.match(inventory, /getHostelInventory/);
  assert.match(inventory, /ROOM|room/);
  assert.match(inventory, /<ConfirmationDialog/);
});
