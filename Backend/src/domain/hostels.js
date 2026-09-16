export const HOSTEL_RESIDENT_TYPES = Object.freeze({
  BOYS: "boys",
  GIRLS: "girls",
  CO_ED: "co_ed",
});

export const HOSTEL_RESIDENT_TYPE_LABELS = Object.freeze({
  [HOSTEL_RESIDENT_TYPES.BOYS]: "Boys hostel",
  [HOSTEL_RESIDENT_TYPES.GIRLS]: "Girls hostel",
  [HOSTEL_RESIDENT_TYPES.CO_ED]: "Co-ed hostel",
});

export const STUDENT_HOUSING_TYPES = Object.freeze({
  BOYS: "boys",
  GIRLS: "girls",
});

export const isHousingCompatible = (studentType, hostelType) =>
  hostelType === HOSTEL_RESIDENT_TYPES.CO_ED || studentType === hostelType;
