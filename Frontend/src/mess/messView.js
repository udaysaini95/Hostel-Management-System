export const MEAL_SECTIONS = Object.freeze([
  Object.freeze({ key: "breakfast", label: "Breakfast" }),
  Object.freeze({ key: "lunch", label: "Lunch" }),
  Object.freeze({ key: "snacks", label: "Snacks" }),
  Object.freeze({ key: "dinner", label: "Dinner" }),
]);

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const dateParts = (date) => date.split("-").map(Number);

export const getLocalCalendarDate = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const addCalendarDays = (date, amount) => {
  const [year, month, day] = dateParts(date);
  const value = new Date(Date.UTC(year, month - 1, day + amount, 12));
  return value.toISOString().slice(0, 10);
};

export const getCalendarRange = (startDate, days = 7) => ({
  from: startDate,
  to: addCalendarDays(startDate, days - 1),
});

export const getCalendarDates = (startDate, days = 7) =>
  Array.from({ length: days }, (_, index) => addCalendarDays(startDate, index));

export const formatMenuDate = (date, options = {}) => {
  if (!DATE_PATTERN.test(date)) return "Unknown date";
  const [year, month, day] = dateParts(date);
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
    ...options,
  }).format(new Date(Date.UTC(year, month - 1, day, 12)));
};

export const menuByDate = (menus = []) =>
  new Map(menus.map((menu) => [menu.date, menu]));

export const mealTextToItems = (value) =>
  value
    .split(/\r?\n/)
    .map((item) => item.trim().replace(/\s+/g, " "))
    .filter(Boolean);

export const menuToEditor = (menu) =>
  Object.fromEntries(
    MEAL_SECTIONS.map(({ key }) => [key, (menu?.meals?.[key] ?? []).join("\n")])
  );

export const validateMenuEditor = (fields) => {
  const meals = {};
  const errors = {};

  for (const { key, label } of MEAL_SECTIONS) {
    const items = mealTextToItems(fields[key] ?? "");
    const required = key !== "snacks";
    const normalizedNames = items.map((item) => item.toLocaleLowerCase("en"));

    if (required && items.length === 0) {
      errors[key] = `${label} needs at least one item.`;
    } else if (items.length > 30) {
      errors[key] = `${label} can contain at most 30 items.`;
    } else if (items.some((item) => item.length > 100)) {
      errors[key] = "Each item must contain at most 100 characters.";
    } else if (new Set(normalizedNames).size !== normalizedNames.length) {
      errors[key] = `${label} contains a duplicate item.`;
    }

    if (items.length > 0) meals[key] = items;
  }

  return { meals, errors, valid: Object.keys(errors).length === 0 };
};

