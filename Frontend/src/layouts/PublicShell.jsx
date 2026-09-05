import { Outlet, useLocation } from "react-router-dom";
import { ButtonLink } from "../components/ui";
import { ProductBrand } from "./ProductBrand.jsx";

const getPublicActions = (pathname) => {
  if (pathname.includes("register")) {
    return [{ label: "Sign in", path: "/login", variant: "primary" }];
  }

  if (pathname.includes("login")) {
    return [
      {
        label: "Create student account",
        path: "/register",
        variant: "secondary",
      },
    ];
  }

  return [
    { label: "Sign in", path: "/login", variant: "primary" },
    {
      label: "Student registration",
      path: "/register",
      variant: "secondary",
    },
  ];
};

export const PublicShell = () => {
  const location = useLocation();
  const actions = getPublicActions(location.pathname);

  return (
    <div className="hm-public-shell">
      <a href="#main-content" className="hm-skip-link">
        Skip to main content
      </a>

      <header className="hm-public-header">
        <div className="hm-public-header__inner">
          <ProductBrand />
          <nav className="hm-public-header__actions" aria-label="Account access">
            {actions.map((action) => (
              <ButtonLink
                key={action.path}
                to={action.path}
                variant={action.variant}
              >
                {action.label}
              </ButtonLink>
            ))}
          </nav>
        </div>
      </header>

      <main id="main-content" className="hm-public-shell__main" tabIndex={-1}>
        <Outlet />
      </main>
    </div>
  );
};
