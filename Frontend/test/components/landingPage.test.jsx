import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, test } from "vitest";
import LandingPage from "../../src/pages/LandingPage.jsx";
import { expectNoAccessibilityViolations } from "../support/accessibility.js";

const renderLandingPage = () =>
  render(
    <MemoryRouter>
      <LandingPage />
    </MemoryRouter>
  );

describe("public landing page", () => {
  test("presents real product workflows and honest access paths", () => {
    renderLandingPage();

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "One operating system for hostel life.",
      })
    ).toBeVisible();
    expect(
      screen.getByRole("link", { name: /Open your workspace/ })
    ).toHaveAttribute("href", "/login");
    expect(
      screen.getAllByRole("link", { name: /Activate student account/i })[0]
    ).toHaveAttribute("href", "/register");
    expect(screen.getByLabelText("Sample HostelMate records")).toHaveTextContent(
      "PRODUCT PREVIEW · SAMPLE RECORDS"
    );
    expect(screen.getByText("One mess operation per hostel")).toBeVisible();
    expect(screen.queryByText(/production-grade/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/PostgreSQL/i)).not.toBeInTheDocument();
  });

  test("changes the product preview when a role is selected", async () => {
    const user = userEvent.setup();
    renderLandingPage();

    const studentTab = screen.getByRole("tab", { name: "Student" });
    const wardenTab = screen.getByRole("tab", { name: "Warden" });
    expect(studentTab).toHaveAttribute("aria-selected", "true");
    expect(screen.getByLabelText("Student product preview")).toBeVisible();

    await user.click(wardenTab);

    expect(wardenTab).toHaveAttribute("aria-selected", "true");
    expect(studentTab).toHaveAttribute("aria-selected", "false");
    expect(screen.getByLabelText("Warden product preview")).toBeVisible();
    expect(screen.getByText("Complaint queue")).toBeVisible();

    await user.keyboard("{ArrowRight}");

    expect(screen.getByRole("tab", { name: "Maintenance" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    expect(screen.getByLabelText("Maintenance product preview")).toBeVisible();
  });

  test("has no detectable accessibility violations", async () => {
    const view = renderLandingPage();

    await expectNoAccessibilityViolations(view.container);
  });
});
