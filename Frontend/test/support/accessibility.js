import axe from "axe-core";
import { expect } from "vitest";

const describeViolations = (violations) =>
  violations
    .map((violation) => `${violation.id}: ${violation.help}`)
    .join("\n");

export const expectNoAccessibilityViolations = async (container) => {
  const result = await axe.run(container, {
    rules: {
      // jsdom has no layout engine, so it cannot calculate rendered contrast.
      "color-contrast": { enabled: false },
    },
  });

  expect(
    result.violations,
    describeViolations(result.violations)
  ).toEqual([]);
};
