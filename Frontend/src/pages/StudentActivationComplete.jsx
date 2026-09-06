import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  KeyRound,
  Link2Off,
  ShieldCheck,
} from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import api from "../api/axios.js";
import { getApiErrorMessage } from "../api/errors.js";
import { useAuth } from "../auth/authContext.js";
import { AUTH_STATUS } from "../auth/session.js";
import { Button, ButtonLink, Input, Panel } from "../components/ui/index.js";
import { getRoleHome } from "../layouts/navigation.js";
import {
  ACTIVATION_UNAVAILABLE_MESSAGE,
  getActivationFieldErrors,
  isActivationTokenValid,
  isActivationUnavailableError,
  validateActivationPassword,
} from "../onboarding/studentActivation.js";

const StudentActivationComplete = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { status, user, signIn, signOut } = useAuth();
  const [activationToken] = useState(
    () => new URLSearchParams(location.search).get("token")?.trim() ?? ""
  );
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [completionError, setCompletionError] = useState("");
  const [linkUnavailable, setLinkUnavailable] = useState(
    () => !isActivationTokenValid(activationToken)
  );
  const [activationResult, setActivationResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const passwordRef = useRef(null);
  const confirmPasswordRef = useRef(null);

  useEffect(() => {
    if (location.search) {
      navigate(location.pathname, { replace: true });
    }
  }, [location.pathname, location.search, navigate]);

  const focusFirstError = (errors) => {
    const firstField = ["password", "confirmPassword"].find(
      (field) => errors[field]
    );
    const fields = { password: passwordRef, confirmPassword: confirmPasswordRef };

    if (firstField) {
      window.requestAnimationFrame(() => fields[firstField].current?.focus());
    }
  };

  const submitPassword = async (event) => {
    event.preventDefault();
    const clientErrors = validateActivationPassword({
      password,
      confirmPassword,
    });

    if (Object.keys(clientErrors).length > 0) {
      setFieldErrors(clientErrors);
      focusFirstError(clientErrors);
      return;
    }

    try {
      setSubmitting(true);
      setCompletionError("");
      const response = await api.post("/api/auth/student-activation/complete", {
        token: activationToken,
        password,
      });
      try {
        const sessionUser = signIn(response.data);
        setActivationResult({
          user: {
            ...sessionUser,
            hostel: response.data?.user?.hostel ?? null,
          },
          sessionStarted: true,
        });
      } catch {
        setActivationResult({
          user: response.data?.user ?? null,
          sessionStarted: false,
        });
      }
      setPassword("");
      setConfirmPassword("");
    } catch (error) {
      if (isActivationUnavailableError(error)) {
        setLinkUnavailable(true);
        return;
      }

      const serverErrors = getActivationFieldErrors(error, ["password"]);
      setFieldErrors(serverErrors);
      setCompletionError(
        getApiErrorMessage(
          error,
          "The account could not be activated. Please try again."
        )
      );
      focusFirstError(serverErrors);
    } finally {
      setSubmitting(false);
    }
  };

  if (activationResult) {
    const activatedUser = activationResult.user;

    return (
      <div className="hm-activation-page">
        <Panel className="hm-activation-card hm-activation-card--result">
          <div className="hm-activation-result" role="status" aria-live="polite">
            <span
              className="hm-activation-result__icon hm-activation-result__icon--success"
              aria-hidden="true"
            >
              <CheckCircle2 />
            </span>
            <div>
              <p className="hm-activation-card__eyebrow">Activation complete</p>
              <h1>Your student account is ready</h1>
              <p>
                Your email is verified and your account is connected to
                {activatedUser?.hostel?.code
                  ? ` ${activatedUser.hostel.code} — ${activatedUser.hostel.name}`
                  : " your assigned hostel"}.
              </p>
              {!activationResult.sessionStarted && (
                <p>
                  Your account was activated, but this browser could not save
                  the session. Sign in with your new password to continue.
                </p>
              )}
            </div>
            <ButtonLink
              to={
                activationResult.sessionStarted
                  ? getRoleHome(activatedUser?.role)
                  : "/login"
              }
              variant="primary"
              fullWidth
            >
              {activationResult.sessionStarted
                ? "Open student dashboard"
                : "Continue to sign in"}
            </ButtonLink>
          </div>
        </Panel>
      </div>
    );
  }

  if (status === AUTH_STATUS.CHECKING) {
    return (
      <div className="hm-activation-page">
        <Panel className="hm-activation-card hm-activation-card--result" role="status">
          <div className="hm-activation-result">
            <span className="hm-activation-result__icon" aria-hidden="true">
              <ShieldCheck />
            </span>
            <div>
              <h1>Checking your current session</h1>
              <p>Please wait before continuing with account activation.</p>
            </div>
          </div>
        </Panel>
      </div>
    );
  }

  if (status === AUTH_STATUS.AUTHENTICATED) {
    return (
      <div className="hm-activation-page">
        <Panel className="hm-activation-card hm-activation-card--result">
          <div className="hm-activation-result">
            <span className="hm-activation-result__icon" aria-hidden="true">
              <ShieldCheck />
            </span>
            <div>
              <p className="hm-activation-card__eyebrow">Active session</p>
              <h1>You are already signed in</h1>
              <p>
                Continue to your current workspace, or sign out before activating
                a different student account.
              </p>
            </div>
            <div className="hm-activation-card__actions">
              <ButtonLink to={getRoleHome(user.role)} variant="primary">
                Open my workspace
              </ButtonLink>
              <Button onClick={() => signOut()}>Sign out and continue</Button>
            </div>
          </div>
        </Panel>
      </div>
    );
  }

  if (linkUnavailable) {
    return (
      <div className="hm-activation-page">
        <Panel className="hm-activation-card hm-activation-card--result">
          <div className="hm-activation-result" role="alert">
            <span
              className="hm-activation-result__icon hm-activation-result__icon--danger"
              aria-hidden="true"
            >
              <Link2Off />
            </span>
            <div>
              <p className="hm-activation-card__eyebrow">Link unavailable</p>
              <h1>This activation link cannot be used</h1>
              <p>{ACTIVATION_UNAVAILABLE_MESSAGE}</p>
            </div>
            <div className="hm-activation-result__note">
              Request a new email using the same approved institutional details.
              If the problem continues, contact your hostel office.
            </div>
            <div className="hm-activation-card__actions">
              <ButtonLink to="/register" variant="primary">
                Request a new link
              </ButtonLink>
              <Link to="/login" className="hm-activation-card__text-link">
                Return to sign in
              </Link>
            </div>
          </div>
        </Panel>
      </div>
    );
  }

  return (
    <div className="hm-activation-page">
      <div className="hm-activation-page__container">
        <Link to="/register" className="hm-activation-page__back">
          <ArrowLeft aria-hidden="true" />
          <span>Request a different link</span>
        </Link>

        <Panel className="hm-activation-card">
          <div className="hm-activation-card__heading">
            <span className="hm-activation-card__heading-icon" aria-hidden="true">
              <KeyRound />
            </span>
            <p className="hm-activation-card__eyebrow">Secure account setup</p>
            <h1>Create your password</h1>
            <p>
              Finish activating your approved student account. This link works
              once and expires after 30 minutes.
            </p>
          </div>

          {completionError && (
            <div className="hm-activation-card__error" role="alert">
              <AlertCircle aria-hidden="true" />
              <span>{completionError}</span>
            </div>
          )}

          <form
            className="hm-activation-form"
            noValidate
            onSubmit={submitPassword}
          >
            <Input
              ref={passwordRef}
              autoFocus
              label="Password"
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={12}
              placeholder="Create a password"
              hint="Use at least 12 characters. Spaces are allowed."
              required
              value={password}
              error={fieldErrors.password}
              onChange={(event) => {
                setPassword(event.target.value);
                setFieldErrors((current) => ({ ...current, password: "" }));
                setCompletionError("");
              }}
            />
            <Input
              ref={confirmPasswordRef}
              label="Confirm password"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              minLength={12}
              placeholder="Enter the password again"
              required
              value={confirmPassword}
              error={fieldErrors.confirmPassword}
              onChange={(event) => {
                setConfirmPassword(event.target.value);
                setFieldErrors((current) => ({
                  ...current,
                  confirmPassword: "",
                }));
                setCompletionError("");
              }}
            />
            <Button
              type="submit"
              variant="primary"
              size="form"
              fullWidth
              loading={submitting}
              loadingLabel="Activating account"
            >
              Activate account
            </Button>
          </form>
        </Panel>
      </div>
    </div>
  );
};

export default StudentActivationComplete;
