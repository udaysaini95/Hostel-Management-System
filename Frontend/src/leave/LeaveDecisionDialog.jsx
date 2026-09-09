import { useEffect, useRef, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { getApiErrorMessage } from "../api/errors.js";
import { Button, Dialog, Textarea } from "../components/ui/index.js";
import { decideLeaveRequest } from "./leaveReviewApi.js";
import {
  formatLeaveRange,
  getReviewWarning,
  validateDecisionNote,
} from "./leaveReviewView.js";

export const LeaveDecisionDialog = ({ review, onDismiss, onDecided }) => {
  const [note, setNote] = useState("");
  const [noteError, setNoteError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const noteRef = useRef(null);

  useEffect(() => {
    setNote("");
    setNoteError("");
    setSubmitError("");
  }, [review]);

  if (!review) return null;

  const { leave, outcome } = review;
  const approving = outcome === "approved";
  const warning = getReviewWarning(leave);
  const approvalBlocked = approving && warning?.blocksApproval;

  const submitDecision = async (event) => {
    event.preventDefault();
    const validationError = validateDecisionNote(note);

    setNoteError(validationError);
    setSubmitError("");
    if (validationError) {
      noteRef.current?.focus();
      return;
    }
    if (approvalBlocked) return;

    try {
      setSubmitting(true);
      const result = await decideLeaveRequest(leave.id, {
        outcome,
        note: note.trim(),
      });
      onDecided(result);
    } catch (error) {
      setSubmitError(
        getApiErrorMessage(error, "The leave decision could not be saved.")
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open
      title={approving ? "Approve leave request" : "Reject leave request"}
      description={`${leave.student.name} · ${leave.student.rollNo}`}
      dismissDisabled={submitting}
      onDismiss={onDismiss}
      footer={
        <>
          <Button disabled={submitting} onClick={onDismiss}>Cancel</Button>
          <Button
            type="submit"
            form="leave-decision-form"
            variant={approving ? "primary" : "danger"}
            loading={submitting}
            loadingLabel={approving ? "Approving" : "Rejecting"}
            disabled={approvalBlocked}
          >
            {approving ? "Approve and issue pass" : "Reject request"}
          </Button>
        </>
      }
    >
      <form
        id="leave-decision-form"
        className="hm-leave-review-dialog"
        noValidate
        onSubmit={submitDecision}
      >
        <dl className="hm-leave-review-dialog__summary">
          <div>
            <dt>Schedule</dt>
            <dd>{formatLeaveRange(leave)}</dd>
          </div>
          <div>
            <dt>Hostel and room</dt>
            <dd>{leave.hostel.code} · {leave.room?.label ?? "Room unavailable"}</dd>
          </div>
          <div>
            <dt>Reason</dt>
            <dd>{leave.reason}</dd>
          </div>
        </dl>

        {warning && (
          <div
            className={`hm-leave-review__warning hm-leave-review__warning--${warning.tone}`}
            role={warning.blocksApproval ? "alert" : "status"}
          >
            <AlertTriangle aria-hidden="true" />
            <div>
              <strong>{warning.title}</strong>
              <span>{warning.message}</span>
            </div>
          </div>
        )}

        <Textarea
          ref={noteRef}
          label="Decision note"
          required
          rows={5}
          maxLength={1000}
          hint={
            approving
              ? "Record what you verified before issuing the gate pass."
              : "Explain clearly why this request cannot be approved."
          }
          error={noteError}
          disabled={submitting}
          value={note}
          onChange={(event) => {
            setNote(event.target.value);
            setNoteError("");
            setSubmitError("");
          }}
        />

        {submitError && (
          <p className="hm-leave-review-dialog__error" role="alert">
            {submitError}
          </p>
        )}
      </form>
    </Dialog>
  );
};
