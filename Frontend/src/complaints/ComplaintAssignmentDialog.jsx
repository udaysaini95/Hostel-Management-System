import { useEffect, useState } from "react";
import { getApiErrorMessage } from "../api/errors.js";
import {
  Button,
  Dialog,
  ErrorState,
  LoadingState,
  Select,
  Textarea,
} from "../components/ui/index.js";
import {
  assignComplaint,
  getComplaintAssignees,
} from "./complaintApi.js";

export const ComplaintAssignmentDialog = ({ complaint, onAssigned, onDismiss }) => {
  const [assignees, setAssignees] = useState([]);
  const [assigneeId, setAssigneeId] = useState("");
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  const isReassignment = Boolean(complaint?.assignment);

  useEffect(() => {
    if (!complaint) return undefined;

    let active = true;
    setAssignees([]);
    setAssigneeId("");
    setReason("");
    setReasonError("");
    setSubmitError("");
    const loadAssignees = async () => {
      try {
        setLoading(true);
        setLoadError("");
        const result = await getComplaintAssignees(complaint.hostel.code);
        if (active) setAssignees(result.data);
      } catch (error) {
        if (active) {
          setLoadError(
            getApiErrorMessage(error, "Available technicians could not be loaded.")
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    loadAssignees();
    return () => { active = false; };
  }, [complaint, retryCount]);

  if (!complaint) return null;

  const submitAssignment = async (event) => {
    event.preventDefault();
    const selectedId = Number(assigneeId);
    const cleanReason = reason.trim();

    setReasonError("");
    setSubmitError("");

    if (!Number.isSafeInteger(selectedId) || selectedId < 1) {
      setSubmitError("Choose a maintenance technician.");
      return;
    }
    if (selectedId === complaint.assignment?.assignee.id) {
      setSubmitError("Choose a different technician for reassignment.");
      return;
    }
    if (isReassignment && cleanReason.length < 5) {
      setReasonError("Explain the reassignment using at least 5 characters.");
      return;
    }

    try {
      setSubmitting(true);
      const result = await assignComplaint(complaint.id, {
        assigneeUserId: selectedId,
        ...(cleanReason ? { reason: cleanReason } : {}),
      });
      onAssigned(result.complaint);
    } catch (error) {
      setSubmitError(
        getApiErrorMessage(error, "The complaint could not be assigned.")
      );
    } finally {
      setSubmitting(false);
    }
  };

  const availableAssignees = assignees.filter(
    (assignee) => assignee.id !== complaint.assignment?.assignee.id
  );

  return (
    <Dialog
      open
      title={isReassignment ? "Reassign complaint" : "Assign complaint"}
      description={`Complaint #${complaint.id} · ${complaint.hostel.code}`}
      dismissDisabled={submitting}
      onDismiss={onDismiss}
      footer={
        <>
          <Button disabled={submitting} onClick={onDismiss}>Cancel</Button>
          <Button
            type="submit"
            form="complaint-assignment-form"
            variant="primary"
            loading={submitting}
            loadingLabel={isReassignment ? "Reassigning" : "Assigning"}
            disabled={loading || Boolean(loadError) || availableAssignees.length === 0}
          >
            {isReassignment ? "Reassign technician" : "Assign technician"}
          </Button>
        </>
      }
    >
      {loading ? (
        <LoadingState compact label="Loading available technicians" rows={3} />
      ) : loadError ? (
        <ErrorState
          title="Technicians unavailable"
          description={loadError}
          onRetry={() => setRetryCount((current) => current + 1)}
        />
      ) : (
        <form
          id="complaint-assignment-form"
          className="hm-assignment-form"
          noValidate
          onSubmit={submitAssignment}
        >
          {isReassignment && (
            <p className="hm-assignment-form__current">
              Currently assigned to <strong>{complaint.assignment.assignee.name}</strong>.
            </p>
          )}
          <Select
            label="Maintenance technician"
            required
            value={assigneeId}
            onChange={(event) => {
              setAssigneeId(event.target.value);
              setSubmitError("");
            }}
          >
            <option value="">Select a technician</option>
            {availableAssignees.map((assignee) => (
              <option key={assignee.id} value={assignee.id}>
                {assignee.name} · {assignee.activeAssignmentCount} active
              </option>
            ))}
          </Select>
          {availableAssignees.length === 0 && (
            <p className="hm-assignment-form__empty">
              No other active maintenance technicians are assigned to this hostel.
            </p>
          )}
          {isReassignment && (
            <Textarea
              label="Reason for reassignment"
              required
              rows={4}
              maxLength={500}
              value={reason}
              error={reasonError}
              placeholder="Explain why the technician is changing."
              onChange={(event) => {
                setReason(event.target.value);
                setReasonError("");
                setSubmitError("");
              }}
            />
          )}
          {submitError && <p className="hm-complaints__form-error" role="alert">{submitError}</p>}
        </form>
      )}
    </Dialog>
  );
};
