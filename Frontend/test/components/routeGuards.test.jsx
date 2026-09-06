import { render, screen } from "@testing-library/react";
import {
  MemoryRouter,
  Outlet,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import { describe, expect, test, vi } from "vitest";
import { AuthContext } from "../../src/auth/authContext.js";
import {
  RequireAuthentication,
  RequireRole,
} from "../../src/auth/RouteGuards.jsx";
import { AUTH_STATUS } from "../../src/auth/session.js";
import { expectNoAccessibilityViolations } from "../support/accessibility.js";

const users = Object.freeze({
  admin: {
    id: 1,
    name: "Mira Sen",
    email: "admin@hostelmate.example",
    role: "admin",
  },
  warden: {
    id: 2,
    name: "Neel Shah",
    email: "warden.h1@hostelmate.example",
    role: "warden",
  },
});

const Destination = ({ title }) => {
  const location = useLocation();

  return (
    <main>
      <h1>{title}</h1>
      {location.state?.message && <p>{location.state.message}</p>}
    </main>
  );
};

const AdminBoundary = () => (
  <RequireRole allowedRoles={["admin"]} />
);

const renderProtectedRoute = ({ status, user = null }) =>
  render(
    <AuthContext.Provider
      value={{
        status,
        user,
        message: null,
        retrySessionCheck: vi.fn(),
        signOut: vi.fn(),
      }}
    >
      <MemoryRouter initialEntries={["/admin/student-approvals"]}>
        <Routes>
          <Route path="/login" element={<Destination title="Sign in" />} />
          <Route path="/unauthorized" element={<Destination title="Access denied" />} />
          <Route element={<RequireAuthentication />}>
            <Route element={<AdminBoundary />}>
              <Route element={<Outlet />}>
                <Route
                  path="/admin/student-approvals"
                  element={<Destination title="Student onboarding" />}
                />
              </Route>
            </Route>
          </Route>
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>
  );

describe("protected route boundaries", () => {
  test("redirects an anonymous direct visit to sign in", () => {
    renderProtectedRoute({ status: AUTH_STATUS.ANONYMOUS });

    expect(screen.getByRole("heading", { name: "Sign in" })).toBeVisible();
    expect(screen.getByText("Sign in to access that page.")).toBeVisible();
  });

  test("redirects an authenticated warden away from the admin-only route", () => {
    renderProtectedRoute({
      status: AUTH_STATUS.AUTHENTICATED,
      user: users.warden,
    });

    expect(screen.getByRole("heading", { name: "Access denied" })).toBeVisible();
  });

  test("renders the route for an administrator without accessibility violations", async () => {
    const view = renderProtectedRoute({
      status: AUTH_STATUS.AUTHENTICATED,
      user: users.admin,
    });

    expect(
      screen.getByRole("heading", { name: "Student onboarding" })
    ).toBeVisible();
    await expectNoAccessibilityViolations(view.container);
  });
});
