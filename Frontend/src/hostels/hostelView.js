export const HOSTEL_RESIDENT_TYPES = Object.freeze([
  { value: "boys", label: "Boys hostel" },
  { value: "girls", label: "Girls hostel" },
  { value: "co_ed", label: "Co-ed hostel" },
]);

export const STUDENT_HOUSING_TYPES = Object.freeze([
  { value: "boys", label: "Boys housing" },
  { value: "girls", label: "Girls housing" },
]);

export const isHousingCompatible = (housingType, residentType) =>
  residentType === "co_ed" || housingType === residentType;

export const getStudentHousingLabel = (housingType) =>
  STUDENT_HOUSING_TYPES.find((type) => type.value === housingType)?.label ??
  "Not recorded";

const residentTypeLabels = Object.freeze(
  Object.fromEntries(HOSTEL_RESIDENT_TYPES.map(({ value, label }) => [value, label]))
);

export const getResidentTypeLabel = (value) =>
  residentTypeLabels[value] ?? "Not specified";

export const validateHostelForm = (form) => {
  const errors = {};

  if (!/^[A-Z][A-Z0-9-]{0,19}$/.test(form.code.trim().toUpperCase())) {
    errors.code = "Use 1–20 uppercase letters, numbers, or hyphens.";
  }
  if (form.name.trim().length < 2) {
    errors.name = "Enter a hostel name.";
  }
  if (!residentTypeLabels[form.residentType]) {
    errors.residentType = "Select who this hostel accommodates.";
  }
  if (form.address.trim().length > 1000) {
    errors.address = "Address must contain at most 1000 characters.";
  }

  return errors;
};

const INVENTORY_CODE_PATTERN = /^[A-Z][A-Z0-9-]{0,19}$/;
const ROOM_NUMBER_PATTERN = /^[A-Z0-9][A-Z0-9-]{0,19}$/;

export const validateBlockForm = (form) => {
  const errors = {};
  const code = form.code.trim().toUpperCase();
  const name = form.name.trim();

  if (!INVENTORY_CODE_PATTERN.test(code)) {
    errors.code = "Start with a letter and use letters, numbers, or hyphens.";
  }
  if (name.length < 2 || name.length > 255) {
    errors.name = "Enter a block name between 2 and 255 characters.";
  }

  return errors;
};

export const validateRoomForm = (form) => {
  const errors = {};
  const roomNumber = form.roomNumber.trim().toUpperCase();
  const floor = Number(form.floor);
  const capacity = Number(form.capacity);

  if (!ROOM_NUMBER_PATTERN.test(roomNumber)) {
    errors.roomNumber = "Use letters, numbers, or hyphens.";
  }
  if (!Number.isInteger(floor) || floor < 0 || floor > 200) {
    errors.floor = "Enter a floor from 0 to 200.";
  }
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 20) {
    errors.capacity = "Enter a capacity from 1 to 20.";
  }

  return errors;
};
