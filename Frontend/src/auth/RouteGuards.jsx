import { LoaderCircle, ShieldAlert } from "lucide-react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { Button, Panel } from "../components/ui/index.js";
import { ProductBrand } from "../layouts/ProductBrand.jsx";
import { getRoleHome } from "../layouts/navigation.js";
import { useAuth } from "./authContext.js";
import { AUTH_STATUS } from "./session.js";

const SessionCheck = ({ embedded = false }) => {
  const content = (
    <Panel
      className="hm-session-gate__panel"
      role="status"
      aria-live="polite"
      aria-label="Checking your sign-in session"
    >
      <LoaderCircle className="hm-session-gate__spinner" aria-hidden="true" />
      <h1>Checking your session</h1>
      <p>Please wait while HostelMate confirms your account.</p>
    </Panel>
  );

  if (embedded) {
    return <div className="hm-session-gate hm-session-gate--embedded">{content}</div>;
  }

  return (
    <main className="hm-session-gate">
      <ProductBrand />
      {content}
    </main>
  );
};

const SessionUnavailable = ({ embedded = false }) => {
  const { message, retrySessionCheck, signOut } = useAuth();
  const content = (
    <Panel className="hm-session-gate__panel" role="alert">
      <ShieldAlert className="hm-session-gate__icon" aria-hidden="true" />
      <h1>We could not verify your session</h1>
      <p>{message}</p>
      <div className="hm-session-gate__actions">
        <Button variant="primary" onClick={() => retrySessionCheck()}>
          Try again
        </Button>
        <Button onClick={() => signOut()}>Return to sign in</Button>
      </div>
    </Panel>
  );

  if (embedded) {
    return <div className="hm-session-gate hm-session-gate--embedded">{content}</div>;
  }

  return (
    <main className="hm-session-gate">
      <ProductBrand />
      {content}
    </main>
  );
};

export const RequireAuthentication = () => {
  const location = useLocation();
  const { status, message } = useAuth();

  if (status === AUTH_STATUS.CHECKING) {
    return <SessionCheck />;
  }

  if (status === AUTH_STATUS.UNAVAILABLE) {
    return <SessionUnavailable />;
  }

  if (status !== AUTH_STATUS.AUTHENTICATED) {
    return (
      <Navigate
        to="/login"
        replace
        state={{
          from: location,
          message: message || "Sign in to access that page.",
        }}
      />
    );
  }

  return <Outlet />;
};

export const RequireRole = ({ allowedRoles }) => {
  const location = useLocation();
  const { user } = useAuth();

  if (!allowedRoles.includes(user.role)) {
    return (
      <Navigate
        to="/unauthorized"
        replace
        state={{ attemptedPath: location.pathname }}
      />
    );
  }

  return <Outlet />;
};

export const GuestOnly = () => {
  const { status, user } = useAuth();

  if (status === AUTH_STATUS.CHECKING) {
    return <SessionCheck embedded />;
  }

  if (status === AUTH_STATUS.UNAVAILABLE) {
    return <SessionUnavailable embedded />;
  }

  if (status === AUTH_STATUS.AUTHENTICATED) {
    return <Navigate to={getRoleHome(user.role)} replace />;
  }

  return <Outlet />;
};
