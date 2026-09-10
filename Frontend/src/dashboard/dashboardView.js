const dateTimeFormatter = new Intl.DateTimeFormat("en-IN", {
  dateStyle: "medium",
  timeStyle: "short",
});

export const formatDashboardDateTime = (value, fallback = "Not available") => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : dateTimeFormatter.format(date);
};

export const formatDashboardStatus = (value) => {
  if (typeof value !== "string" || !value.trim()) return "Unknown";
  return value
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

export const groupMenuItems = (items = []) => {
  const groups = new Map();

  for (const item of items) {
    if (!item?.mealType || !item?.name) continue;
    const names = groups.get(item.mealType) ?? [];
    names.push(item.name);
    groups.set(item.mealType, names);
  }

  return [...groups.entries()].map(([mealType, names]) => ({ mealType, names }));
};

export const isDashboardMetric = (metric) =>
  Boolean(
    metric &&
    typeof metric === "object" &&
    Object.hasOwn(metric, "value") &&
    metric.value !== undefined &&
    typeof metric.definition === "string"
  );
