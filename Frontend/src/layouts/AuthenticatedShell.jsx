import { createElement, useState } from "react";
import { LogOut, Menu } from "lucide-react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/authContext.js";
import { Button, Drawer } from "../components/ui";
import {
  getNavigationForRole,
  getRoleHome,
  getRouteTitle,
  isNavigationItemActive,
  ROLE_LABELS,
} from "./navigation.js";
import { ProductBrand } from "./ProductBrand.jsx";

const NavigationList = ({ items, pathname, onNavigate }) => (
  <nav className="hm-app-navigation" aria-label="Primary navigation">
    {items.map((item) => {
      const isActive = isNavigationItemActive(pathname, item);

      return (
        <Link
          key={item.path}
          to={item.path}
          onClick={onNavigate}
          className="hm-app-navigation__link"
          aria-current={isActive ? "page" : undefined}
        >
          {createElement(item.icon, {
            className: "hm-app-navigation__icon",
            "aria-hidden": "true",
          })}
          <span>{item.label}</span>
        </Link>
      );
    })}
  </nav>
);

const AccountSummary = ({ user, roleLabel, compact = false }) => {
  const displayName = user?.name || "Signed-in user";
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <div
      className={
        compact
          ? "hm-account-summary hm-account-summary--compact"
          : "hm-account-summary"
      }
    >
      <span className="hm-account-summary__avatar" aria-hidden="true">
        {initial}
      </span>
      <span className="hm-account-summary__details">
        <strong>{displayName}</strong>
        <span>{roleLabel}</span>
      </span>
    </div>
  );
};

export const AuthenticatedShell = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [navigationOpen, setNavigationOpen] = useState(false);
  const role = user.role;
  const roleLabel = ROLE_LABELS[role] || "Account";
  const navigationItems = getNavigationForRole(role);
  const pageTitle = getRouteTitle(location.pathname);
  const contentIsFullWidth = location.pathname === "/guard/terminal";

  const handleSignOut = () => {
    setNavigationOpen(false);
    signOut();
    navigate("/login");
  };

  return (
    <div className="hm-app-shell">
      <a href="#app-main-content" className="hm-skip-link">
        Skip to main content
      </a>

      <aside className="hm-sidebar">
        <div className="hm-sidebar__brand">
          <ProductBrand to={getRoleHome(role)} />
        </div>
        <div className="hm-sidebar__context">
          <span>Workspace</span>
          <strong>{roleLabel}</strong>
        </div>
        <NavigationList
          items={navigationItems}
          pathname={location.pathname}
        />
        <div className="hm-sidebar__account">
          <AccountSummary user={user} roleLabel={roleLabel} />
        </div>
      </aside>

      <div className="hm-app-shell__column">
        <header className="hm-utility-bar">
          <div className="hm-utility-bar__context">
            <Button
              variant="quiet"
              size="icon"
              className="hm-utility-bar__menu-button"
              aria-label="Open navigation"
              title="Open navigation"
              onClick={() => setNavigationOpen(true)}
            >
              <Menu aria-hidden="true" />
            </Button>
            <span className="hm-utility-bar__title">{pageTitle}</span>
          </div>

          <div className="hm-utility-bar__account">
            <AccountSummary user={user} roleLabel={roleLabel} compact />
            <Button
              variant="quiet"
              size="icon"
              aria-label="Sign out"
              title="Sign out"
              onClick={handleSignOut}
            >
              <LogOut aria-hidden="true" />
            </Button>
          </div>
        </header>

        <main id="app-main-content" className="hm-app-shell__main" tabIndex={-1}>
          <div
            className={
              contentIsFullWidth
                ? "hm-app-shell__content hm-app-shell__content--full"
                : "hm-app-shell__content"
            }
          >
            <Outlet />
          </div>
        </main>
      </div>

      <Drawer
        open={navigationOpen}
        title="Navigation"
        description={`${roleLabel} workspace`}
        side="left"
        onDismiss={() => setNavigationOpen(false)}
        className="hm-navigation-drawer"
      >
        <NavigationList
          items={navigationItems}
          pathname={location.pathname}
          onNavigate={() => setNavigationOpen(false)}
        />
        <div className="hm-navigation-drawer__account">
          <AccountSummary user={user} roleLabel={roleLabel} />
          <Button
            variant="secondary"
            fullWidth
            leadingIcon={<LogOut aria-hidden="true" />}
            onClick={handleSignOut}
          >
            Sign out
          </Button>
        </div>
      </Drawer>
    </div>
  );
};
