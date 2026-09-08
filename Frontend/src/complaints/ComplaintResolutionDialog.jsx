import { useEffect, useRef, useState } from "react";
import { Paperclip, X } from "lucide-react";
import { getApiErrorMessage } from "../api/errors.js";
import { Button, Dialog, Textarea } from "../components/ui/index.js";
import { resolveComplaintWork } from "./complaintApi.js";
import {
  formatFileSize,
  validateComplaintImage,
} from "./complaintView.js";

export const ComplaintResolutionDialog = ({
  complaint,
  onDismiss,
  onResolved,
}) => {
  const fileInputRef = useRef(null);
  const [resolutionNote, setResolutionNote] = useState("");
  const [noteError, setNoteError] = useState("");
  const [file, setFile] = useState(null);
  const [fileError, setFileError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setResolutionNote("");
    setNoteError("");
    setFile(null);
    setFileError("");
    setSubmitError("");
  }, [complaint]);

  if (!complaint) return null;

  const selectEvidence = (event) => {
    const selectedFile = event.target.files?.[0] ?? null;
    const validationError = validateComplaintImage(selectedFile);

    if (validationError) {
      setFile(null);
      setFileError(validationError);
      event.target.value = "";
      return;
    }

    setFile(selectedFile);
    setFileError("");
    setSubmitError("");
  };

  const removeEvidence = () => {
    setFile(null);
    setFileError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const submitResolution = async (event) => {
    event.preventDefault();
    const cleanNote = resolutionNote.trim();

    setNoteError("");
    setSubmitError("");
    if (cleanNote.length < 10) {
      setNoteError("Describe the completed repair using at least 10 characters.");
      return;
    }

    try {
      setSubmitting(true);
      const result = await resolveComplaintWork(complaint.id, {
        resolutionNote: cleanNote,
        file,
      });
      onResolved(result);
    } catch (error) {
      setSubmitError(
        getApiErrorMessage(error, "The resolution could not be submitted.")
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open
      title="Resolve work order"
      description={`Complaint #${complaint.id} · ${complaint.category.name}`}
      dismissDisabled={submitting}
      onDismiss={onDismiss}
      footer={
        <>
          <Button disabled={submitting} onClick={onDismiss}>Cancel</Button>
          <Button
            type="submit"
            form="complaint-resolution-form"
            variant="primary"
            loading={submitting}
            loadingLabel="Submitting resolution"
          >
            Submit resolution
          </Button>
        </>
      }
    >
      <form
        id="complaint-resolution-form"
        className="hm-resolution-form"
        noValidate
        onSubmit={submitResolution}
      >
        <Textarea
          label="Resolution note"
          required
          rows={5}
          maxLength={1000}
          hint="Explain what was repaired and how you checked the result."
          error={noteError}
          disabled={submitting}
          value={resolutionNote}
          onChange={(event) => {
            setResolutionNote(event.target.value);
            setNoteError("");
            setSubmitError("");
          }}
        />

        <div className="hm-resolution-form__evidence">
          <div>
            <label htmlFor="resolution-evidence">Resolution evidence</label>
            <span>Optional</span>
          </div>
          <input
            ref={fileInputRef}
            id="resolution-evidence"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={submitting}
            onChange={selectEvidence}
          />
          <p>JPEG, PNG, or WebP. Maximum 5 MB.</p>
          {file && (
            <div className="hm-resolution-form__file">
              <Paperclip aria-hidden="true" />
              <span><strong>{file.name}</strong>{formatFileSize(file.size)}</span>
              <Button
                variant="quiet"
                size="icon"
                aria-label={`Remove ${file.name}`}
                disabled={submitting}
                onClick={removeEvidence}
              >
                <X aria-hidden="true" />
              </Button>
            </div>
          )}
          {fileError && <p className="hm-complaints__field-error" role="alert">{fileError}</p>}
        </div>

        {submitError && <p className="hm-complaints__form-error" role="alert">{submitError}</p>}
      </form>
    </Dialog>
  );
};
