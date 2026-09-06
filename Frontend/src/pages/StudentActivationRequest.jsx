import { useRef, useState } from "react";
import { AlertCircle, ArrowLeft, MailCheck } from "lucide-react";
import { Link } from "react-router-dom";
import api from "../api/axios.js";
import { getApiErrorMessage } from "../api/errors.js";
import { Button, Input, Panel } from "../components/ui/index.js";
import {
  ACTIVATION_REQUEST_SUCCESS_MESSAGE,
  getActivationFieldErrors,
  normalizeActivationRequest,
  validateActivationRequest,
} from "../onboarding/studentActivation.js";

const EMPTY_FORM = Object.freeze({ email: "", rollNo: "" });

const StudentActivationRequest = () => {
  const [form, setForm] = useState(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState({});
  const [requestError, setRequestError] = useState("");
  const [requestSent, setRequestSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const emailRef = useRef(null);
  const rollNoRef = useRef(null);

  const focusFirstError = (errors) => {
    const firstField = ["email", "rollNo"].find((field) => errors[field]);
    const fields = { email: emailRef, rollNo: rollNoRef };

    if (firstField) {
      window.requestAnimationFrame(() => fields[firstField].current?.focus());
    }
  };

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: "" }));
    setRequestError("");
  };

  const submitRequest = async (event) => {
    event.preventDefault();
    const clientErrors = validateActivationRequest(form);

    if (Object.keys(clientErrors).length > 0) {
      setFieldErrors(clientErrors);
      focusFirstError(clientErrors);
      return;
    }

    try {
      setSubmitting(true);
      setRequestError("");
      await api.post(
        "/api/auth/student-activation/request",
        normalizeActivationRequest(form)
      );
      setRequestSent(true);
    } catch (error) {
      const serverErrors = getActivationFieldErrors(error, ["email", "rollNo"]);
      setFieldErrors(serverErrors);
      setRequestError(
        getApiErrorMessage(
          error,
          "The activation request could not be sent. Please try again."
        )
      );
      focusFirstError(serverErrors);
    } finally {
      setSubmitting(false);
    }
  };

  const startAnotherRequest = () => {
    setRequestSent(false);
    setFieldErrors({});
    setRequestError("");
    window.requestAnimationFrame(() => emailRef.current?.focus());
  };

  return (
    <div className="hm-activation-page">
      <div className="hm-activation-page__container">
        <Link to="/" className="hm-activation-page__back">
          <ArrowLeft aria-hidden="true" />
          <span>Back to home</span>
        </Link>

        <Panel className="hm-activation-card">
          {requestSent ? (
            <div className="hm-activation-result" role="status" aria-live="polite">
              <span className="hm-activation-result__icon" aria-hidden="true">
                <MailCheck />
              </span>
              <div>
                <p className="hm-activation-card__eyebrow">Request received</p>
                <h1>Check your email</h1>
                <p>{ACTIVATION_REQUEST_SUCCESS_MESSAGE}</p>
              </div>
              <div className="hm-activation-result__note">
                The link expires after 30 minutes. Submitting another request
                replaces any earlier unused link.
              </div>
              <div className="hm-activation-card__actions">
                <Button variant="primary" onClick={startAnotherRequest}>
                  Send another request
                </Button>
                <Link to="/login" className="hm-activation-card__text-link">
                  Return to sign in
                </Link>
              </div>
            </div>
          ) : (
            <>
              <div className="hm-activation-card__heading">
                <p className="hm-activation-card__eyebrow">Student onboarding</p>
                <h1>Activate your student account</h1>
                <p>
                  Enter the institutional email and roll number already approved
                  by your hostel administrator.
                </p>
              </div>

              <div className="hm-activation-card__notice">
                HostelMate verifies an existing institutional email address. It
                does not create a new email account.
              </div>

              {requestError && (
                <div className="hm-activation-card__error" role="alert">
                  <AlertCircle aria-hidden="true" />
                  <span>{requestError}</span>
                </div>
              )}

              <form
                className="hm-activation-form"
                noValidate
                onSubmit={submitRequest}
              >
                <Input
                  ref={emailRef}
                  autoFocus
                  label="Institutional email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  maxLength={255}
                  placeholder="asha.rao@college.edu"
                  required
                  value={form.email}
                  error={fieldErrors.email}
                  onChange={(event) => updateField("email", event.target.value)}
                />
                <Input
                  ref={rollNoRef}
                  label="Roll number"
                  name="rollNo"
                  autoComplete="off"
                  autoCapitalize="characters"
                  maxLength={50}
                  placeholder="2026-CSE-042"
                  hint="Use the same roll number recorded by the hostel office."
                  required
                  value={form.rollNo}
                  error={fieldErrors.rollNo}
                  onChange={(event) => updateField("rollNo", event.target.value)}
                />
                <Button
                  type="submit"
                  variant="primary"
                  size="form"
                  fullWidth
                  loading={submitting}
                  loadingLabel="Sending request"
                >
                  Send activation email
                </Button>
              </form>

              <div className="hm-activation-card__footer">
                <span>Already activated?</span>
                <Link to="/login">Sign in</Link>
              </div>
            </>
          )}
        </Panel>
      </div>
    </div>
  );
};

export default StudentActivationRequest;
