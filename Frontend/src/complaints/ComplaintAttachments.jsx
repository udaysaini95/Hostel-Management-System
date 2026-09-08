import { Eye, Paperclip, Trash2 } from "lucide-react";
import { Button, EmptyState } from "../components/ui/index.js";
import { formatComplaintDate, formatFileSize } from "./complaintView.js";

export const ComplaintAttachments = ({
  attachments,
  canAdd,
  busyAttachmentId,
  uploading,
  fileError,
  onFileChange,
  onOpen,
  onRemove,
}) => (
  <div className="hm-complaint-attachments">
    {attachments.length === 0 ? (
      <EmptyState
        className="hm-complaint-attachments__empty"
        icon={Paperclip}
        title="No evidence attached"
        description="Photos added during submission or resolution will appear here."
      />
    ) : (
      <ul className="hm-complaint-attachments__list">
        {attachments.map((attachment) => (
          <li key={attachment.id}>
            <div>
              <strong>{attachment.originalName}</strong>
              <span>
                {attachment.purpose === "resolution" ? "Resolution" : "Submission"}
                {" · "}{formatFileSize(attachment.sizeBytes)}
                {" · "}{formatComplaintDate(attachment.createdAt)}
              </span>
            </div>
            <div className="hm-complaint-attachments__actions">
              <Button
                variant="quiet"
                leadingIcon={<Eye aria-hidden="true" />}
                loading={busyAttachmentId === attachment.id}
                loadingLabel="Opening"
                onClick={() => onOpen(attachment)}
              >
                View image
              </Button>
              {canAdd && attachment.purpose === "submission" && (
                <Button
                  variant="danger-secondary"
                  size="icon"
                  aria-label={`Delete ${attachment.originalName}`}
                  disabled={Boolean(busyAttachmentId)}
                  onClick={() => onRemove(attachment)}
                >
                  <Trash2 aria-hidden="true" />
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>
    )}

    {canAdd && (
      <div className="hm-complaint-attachments__upload">
        <label htmlFor="complaint-evidence">Add submission image</label>
        <input
          id="complaint-evidence"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={uploading}
          onChange={onFileChange}
        />
        <p>
          {uploading
            ? "Uploading image…"
            : "JPEG, PNG, or WebP. Maximum 5 MB and five submission images."}
        </p>
        {fileError && <p className="hm-complaints__field-error" role="alert">{fileError}</p>}
      </div>
    )}
  </div>
);
