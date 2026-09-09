import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";
import MessAdmin from "../../src/pages/MessAdmin.jsx";
import MessPage from "../../src/pages/MessPage.jsx";
import { getLocalCalendarDate } from "../../src/mess/messView.js";
import { expectNoAccessibilityViolations } from "../support/accessibility.js";

const apiMocks = vi.hoisted(() => ({
  createMessIssue: vi.fn(),
  getManageableMessHostels: vi.fn(),
  getMessFeedbackSummary: vi.fn(),
  getManagedMessIssues: vi.fn(),
  getMessMenu: vi.fn(),
  getMyMessIssues: vi.fn(),
  listMessMenus: vi.fn(),
  saveMessMenu: vi.fn(),
  submitMealFeedback: vi.fn(),
  updateMessIssueStatus: vi.fn(),
}));
const { showToast } = vi.hoisted(() => ({ showToast: vi.fn() }));

vi.mock("../../src/mess/messApi.js", () => apiMocks);
vi.mock("../../src/feedback/toastContext.js", () => ({
  useToast: () => ({ showToast }),
}));

const today = getLocalCalendarDate();
const menu = {
  id: 11,
  date: today,
  version: 2,
  hostel: { id: 1, code: "H1", name: "North Residence Hall" },
  publishedBy: { id: 2, name: "Mira Sen" },
  publishedAt: "2026-09-09T06:00:00.000Z",
  meals: {
    breakfast: ["Vegetable upma", "Tea"],
    lunch: ["Rajma", "Rice"],
    snacks: [],
    dinner: ["Roti", "Dal"],
  },
};

describe("mess menu calendar screens", () => {
  beforeEach(() => {
    Object.values(apiMocks).forEach((mock) => mock.mockReset());
    showToast.mockReset();
    apiMocks.getMyMessIssues.mockResolvedValue([]);
    apiMocks.getManagedMessIssues.mockResolvedValue([]);
    apiMocks.getManageableMessHostels.mockResolvedValue([
      { id: 1, code: "H1", name: "North Residence Hall" },
      { id: 2, code: "H2", name: "South Residence Hall" },
    ]);
    apiMocks.getMessFeedbackSummary.mockResolvedValue({
      overall: { averageRating: null, responseCount: 0 },
      byMeal: [],
      recentComments: [],
    });
    apiMocks.listMessMenus.mockResolvedValue({ menus: [menu] });
    apiMocks.getMessMenu.mockResolvedValue(menu);
    apiMocks.saveMessMenu.mockResolvedValue({ ...menu, version: 3 });
  });

  test("student sees a date-specific operational menu with accessible navigation", async () => {
    const view = render(<MessPage />);

    expect(await screen.findByText("Vegetable upma")).toBeVisible();
    expect(screen.getByText("North Residence Hall")).toBeVisible();
    expect(screen.getByRole("button", { name: "Show next seven days" })).toBeVisible();
    expect(screen.getByLabelText("Rating: 5 out of 5")).toBeVisible();
    expect(apiMocks.listMessMenus).toHaveBeenCalledWith(
      expect.objectContaining({ from: today, hostelId: undefined })
    );
    await expectNoAccessibilityViolations(view.container);
  });

  test("missing dates show an honest empty state without sample food", async () => {
    apiMocks.listMessMenus.mockResolvedValue({ menus: [] });
    render(<MessPage />);

    expect(await screen.findByText(new RegExp(`No menu published for`))).toBeVisible();
    expect(screen.queryByText("Poha, Tea / Coffee, Boiled Eggs / Milk")).not.toBeInTheDocument();
    expect(screen.queryByText("Paneer Butter Masala, Jeera Rice, Chapati, Gulab Jamun")).not.toBeInTheDocument();
  });

  test("student rates the meal selected in the published calendar", async () => {
    const user = userEvent.setup();
    render(<MessPage />);

    await screen.findByText("Vegetable upma");
    await waitFor(() => expect(screen.getByLabelText("Meal")).not.toBeDisabled());
    await user.selectOptions(screen.getByLabelText("Meal"), "lunch");
    await user.selectOptions(screen.getByLabelText("Rating: 5 out of 5"), "4");
    await user.type(screen.getByLabelText("Comment (optional)"), "Good rajma");
    await user.click(screen.getByRole("button", { name: "Submit rating" }));

    expect(apiMocks.submitMealFeedback).toHaveBeenCalledWith({
      menuId: menu.id,
      mealType: "lunch",
      rating: 4,
      comment: "Good rajma",
    });
  });

  test("feedback analytics shows an honest no-data state", async () => {
    render(<MessAdmin />);

    expect(await screen.findByText("No feedback in this period")).toBeVisible();
    expect(screen.queryByText("4.5 / 5")).not.toBeInTheDocument();
  });

  test("editor loads the selected hostel menu and saves a new version", async () => {
    const user = userEvent.setup();
    render(<MessAdmin />);

    await waitFor(() => {
      expect(screen.getByLabelText("Breakfast")).toHaveValue("Vegetable upma\nTea");
    });
    expect(screen.getByText("Current version 2")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Update menu" }));

    await waitFor(() => {
      expect(apiMocks.saveMessMenu).toHaveBeenCalledWith({
        date: today,
        hostelId: 1,
        meals: {
          breakfast: ["Vegetable upma", "Tea"],
          lunch: ["Rajma", "Rice"],
          dinner: ["Roti", "Dal"],
        },
      });
    });
    expect(showToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Menu updated" })
    );
  });

  test("editor validates required meals before calling the API", async () => {
    apiMocks.getMessMenu.mockRejectedValue({ response: { status: 404 } });
    apiMocks.listMessMenus.mockResolvedValue({ menus: [] });
    const user = userEvent.setup();
    render(<MessAdmin />);

    await screen.findByRole("button", { name: "Publish menu" });
    await user.click(screen.getByRole("button", { name: "Publish menu" }));

    expect(await screen.findByText("Breakfast needs at least one item.")).toBeVisible();
    expect(screen.getByText("Lunch needs at least one item.")).toBeVisible();
    expect(screen.getByText("Dinner needs at least one item.")).toBeVisible();
    expect(apiMocks.saveMessMenu).not.toHaveBeenCalled();
  });
});
