export const joinClassNames = (...values) =>
  values
    .flat()
    .filter((value) => typeof value === "string" && value.trim())
    .join(" ");
