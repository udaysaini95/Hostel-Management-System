import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { Button, Input } from "../../src/components/ui/index.js";
import { expectNoAccessibilityViolations } from "../support/accessibility.js";

describe("shared form primitives", () => {
  test("connects labels, hints, required state, and errors", async () => {
    const view = render(
      <main>
        <Input
          label="Institutional email"
          name="email"
          type="email"
          hint="Use the address approved by your hostel office."
          required
        />
      </main>
    );

    const input = screen.getByRole("textbox", { name: /institutional email/i });
    const hint = screen.getByText(/address approved by your hostel office/i);

    expect(input).toBeRequired();
    expect(input).toHaveAccessibleDescription(hint.textContent);
    expect(screen.getByText("Required")).toBeVisible();
    await expectNoAccessibilityViolations(view.container);

    view.rerender(
      <main>
        <Input
          label="Institutional email"
          name="email"
          type="email"
          error="Enter a valid institutional email address."
          required
        />
      </main>
    );

    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription(
      "Enter a valid institutional email address."
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Enter a valid institutional email address."
    );
  });

  test("exposes loading state without leaving an actionable button", () => {
    render(
      <Button loading loadingLabel="Saving approval">
        Save approval
      </Button>
    );

    const button = screen.getByRole("button", { name: "Saving approval" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
  });
});
