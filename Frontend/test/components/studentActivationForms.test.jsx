import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, test, vi } from "vitest";
import api from "../../src/api/axios.js";
import { AuthContext } from "../../src/auth/authContext.js";
import { AUTH_STATUS } from "../../src/auth/session.js";
import StudentActivationComplete from "../../src/pages/StudentActivationComplete.jsx";
import StudentActivationRequest from "../../src/pages/StudentActivationRequest.jsx";
import { expectNoAccessibilityViolations } from "../support/accessibility.js";

vi.mock("../../src/api/axios.js", () => ({
  default: {
    post: vi.fn(),
  },
}));

const validToken = "a".repeat(43);

const authValue = (overrides = {}) => ({
  status: AUTH_STATUS.ANONYMOUS,
  user: null,
  signIn: vi.fn(),
  signOut: vi.fn(),
  ...overrides,
});

const renderRequestPage = () =>
  render(
    <MemoryRouter>
      <StudentActivationRequest />
    </MemoryRouter>
  );

const renderCompletionPage = (value = authValue()) =>
  render(
    <AuthContext.Provider value={value}>
      <MemoryRouter
        initialEntries={[`/activate-student?token=${validToken}`]}
      >
        <Routes>
          <Route
            path="/activate-student"
            element={<StudentActivationComplete />}
          />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>
  );

describe("student activation request", () => {
  beforeEach(() => {
    api.post.mockReset();
  });

  test("focuses the first invalid field and exposes its errors", async () => {
    const user = userEvent.setup();
    renderRequestPage();

    await user.click(
      screen.getByRole("button", { name: "Send activation email" })
    );

    expect(screen.getByLabelText("Institutional email")).toHaveFocus();
    expect(screen.getAllByRole("alert")).toHaveLength(2);
    expect(api.post).not.toHaveBeenCalled();
  });

  test("normalizes details and always shows the neutral confirmation", async () => {
    const user = userEvent.setup();
    api.post.mockResolvedValue({ status: 202, data: {} });
    renderRequestPage();

    await user.type(
      screen.getByLabelText("Institutional email"),
      "ASHA.RAO@COLLEGE.EDU"
    );
    await user.type(screen.getByLabelText("Roll number"), "2026   cse 042");
    await user.click(
      screen.getByRole("button", { name: "Send activation email" })
    );

    expect(api.post).toHaveBeenCalledWith(
      "/api/auth/student-activation/request",
      {
        email: "asha.rao@college.edu",
        rollNo: "2026 CSE 042",
      }
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "If the student details match an approved record"
    );
    expect(
      screen.getByRole("button", { name: "Send another request" })
    ).toBeVisible();
  });

  test("has no detectable accessibility violations", async () => {
    const view = renderRequestPage();
    await expectNoAccessibilityViolations(view.container);
  });
});

describe("student activation password setup", () => {
  beforeEach(() => {
    api.post.mockReset();
  });

  test("keeps mismatched passwords on the client and focuses confirmation", async () => {
    const user = userEvent.setup();
    renderCompletionPage();

    await user.type(
      screen.getByLabelText("Password"),
      "correct horse battery staple"
    );
    await user.type(
      screen.getByLabelText("Confirm password"),
      "different password"
    );
    await user.click(screen.getByRole("button", { name: "Activate account" }));

    expect(screen.getByLabelText("Confirm password")).toHaveFocus();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "The passwords do not match."
    );
    expect(api.post).not.toHaveBeenCalled();
  });

  test("shows one safe recovery state for an unavailable token", async () => {
    const user = userEvent.setup();
    api.post.mockRejectedValue({
      response: {
        status: 400,
        data: { code: "ACTIVATION_UNAVAILABLE" },
      },
    });
    renderCompletionPage();

    await user.type(screen.getByLabelText("Password"), "long secure password");
    await user.type(
      screen.getByLabelText("Confirm password"),
      "long secure password"
    );
    await user.click(screen.getByRole("button", { name: "Activate account" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "invalid, expired, or has already been used"
    );
    expect(screen.getByRole("link", { name: "Request a new link" })).toHaveAttribute(
      "href",
      "/register"
    );
  });

  test("starts the normal session after successful activation", async () => {
    const user = userEvent.setup();
    const activatedUser = {
      id: 9,
      name: "Asha Rao",
      email: "asha.rao@college.edu",
      role: "student",
    };
    const signIn = vi.fn().mockReturnValue(activatedUser);
    const response = {
      data: {
        token: "signed-session",
        user: {
          ...activatedUser,
          hostel: { code: "H2", name: "River House" },
        },
      },
    };
    api.post.mockResolvedValue(response);
    renderCompletionPage(authValue({ signIn }));

    await user.type(screen.getByLabelText("Password"), "long secure password");
    await user.type(
      screen.getByLabelText("Confirm password"),
      "long secure password"
    );
    await user.click(screen.getByRole("button", { name: "Activate account" }));

    expect(api.post).toHaveBeenCalledWith(
      "/api/auth/student-activation/complete",
      { token: validToken, password: "long secure password" }
    );
    expect(signIn).toHaveBeenCalledWith(response.data);
    expect(
      screen.getByRole("heading", { name: "Your student account is ready" })
    ).toBeVisible();
    expect(screen.getByRole("link", { name: "Open student dashboard" })).toHaveAttribute(
      "href",
      "/student/dashboard"
    );
  });

  test("has no detectable accessibility violations", async () => {
    const view = renderCompletionPage();
    await expectNoAccessibilityViolations(view.container);
  });
});
