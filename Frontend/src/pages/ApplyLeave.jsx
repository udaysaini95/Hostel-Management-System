import { useRef, useState } from "react";
import { ArrowLeft, CalendarClock } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { getApiErrorMessage } from "../api/errors.js";
import {
  Button,
  Input,
  PageHeader,
  Panel,
  Textarea,
} from "../components/ui/index.js";
import { useToast } from "../feedback/toastContext.js";
import { createLeaveRequest } from "../leave/leaveApi.js";
import {
  getLeaveFieldErrors,
  toLeaveRequestPayload,
  validateLeaveForm,
} from "../leave/leaveView.js";

const EMPTY_FORM = Object.freeze({
  reason: "",
  departureAt: "",
  expectedReturnAt: "",
  isEmergency: false,
});

const ApplyLeave = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const departureRef = useRef(null);
  const returnRef = useRef(null);
  const reasonRef = useRef(null);
  const { showToast } = useToast();

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: "" }));
    setFormError("");
  };

  const focusFirstError = (nextErrors) => {
    const refs = {
      departureAt: departureRef,
      expectedReturnAt: returnRef,
      reason: reasonRef,
    };
    const field = ["departureAt", "expectedReturnAt", "reason"].find(
      (name) => nextErrors[name]
    );

    if (field) {
      window.requestAnimationFrame(() => refs[field].current?.focus());
    }
  };

  const submitLeave = async (event) => {
    event.preventDefault();
    const nextErrors = validateLeaveForm(form);

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      focusFirstError(nextErrors);
      return;
    }

    try {
      setSubmitting(true);
      setFormError("");
      await createLeaveRequest(toLeaveRequestPayload(form));
      showToast({
        tone: "success",
        title: "Leave request submitted",
        message: "Your request is waiting for a warden decision.",
      });
      navigate("/student/leaves");
    } catch (error) {
      const serverErrors = getLeaveFieldErrors(error);
      setErrors(serverErrors);
      setFormError(
        getApiErrorMessage(error, "Your leave request could not be submitted.")
      );
      focusFirstError(serverErrors);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="hm-page-stack hm-page-stack--narrow hm-leave-form-page">
      <Link className="hm-leave__back-link" to="/student/leaves">
        <ArrowLeft aria-hidden="true" /> Back to leave requests
      </Link>
      <PageHeader
        eyebrow="Leave and gate pass"
        title="Apply for leave"
        description="Enter local departure and return times. Your current hostel and room are added automatically."
      />

      <Panel
        as="form"
        className="hm-leave-form"
        onSubmit={submitLeave}
        noValidate
      >
        <div className="hm-leave-form__heading">
          <CalendarClock aria-hidden="true" />
          <div>
            <h2>Leave schedule</h2>
            <p>
              Times are interpreted in your device timezone and stored with an
              exact offset.
            </p>
          </div>
        </div>

        {formError && (
          <p className="hm-leave-form__error" role="alert">
            {formError}
          </p>
        )}

        <div className="hm-leave-form__dates">
          <Input
            ref={departureRef}
            label="Departure date and time"
            type="datetime-local"
            required
            value={form.departureAt}
            error={errors.departureAt}
            onChange={(event) =>
              updateField("departureAt", event.target.value)
            }
          />
          <Input
            ref={returnRef}
            label="Expected return date and time"
            type="datetime-local"
            required
            value={form.expectedReturnAt}
            error={errors.expectedReturnAt}
            onChange={(event) =>
              updateField("expectedReturnAt", event.target.value)
            }
          />
        </div>

        <Textarea
          ref={reasonRef}
          label="Reason for leave"
          rows={4}
          maxLength={1000}
          required
          placeholder="For example: travelling home for a family function"
          value={form.reason}
          error={errors.reason}
          onChange={(event) => updateField("reason", event.target.value)}
        />

        <label className="hm-leave-form__emergency">
          <input
            type="checkbox"
            checked={form.isEmergency}
            onChange={(event) =>
              updateField("isEmergency", event.target.checked)
            }
          />
          <span>
            <strong>This is an emergency request</strong>
            <small>
              Wardens will see this flag prominently. It does not skip
              approval.
            </small>
          </span>
        </label>

        <div className="hm-leave-form__footer">
          <span>
            Requests cannot overlap an active pending or approved leave.
          </span>
          <Button
            type="submit"
            variant="primary"
            size="form"
            loading={submitting}
            loadingLabel="Submitting request"
          >
            Apply for leave
          </Button>
        </div>
      </Panel>
    </div>
  );
};

export default ApplyLeave;
