import { Button } from "./Button.jsx";
import { Dialog } from "./Dialog.jsx";

export const ConfirmationDialog = ({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "default",
  loading = false,
  loadingLabel = "Working",
  children,
  onConfirm,
  onDismiss,
}) => (
  <Dialog
    open={open}
    title={title}
    description={description}
    onDismiss={loading ? () => {} : onDismiss}
    dismissDisabled={loading}
    footer={
      <>
        <Button data-autofocus onClick={onDismiss} disabled={loading}>
          {cancelLabel}
        </Button>
        <Button
          variant={tone === "danger" ? "danger" : "primary"}
          loading={loading}
          loadingLabel={loadingLabel}
          onClick={onConfirm}
        >
          {confirmLabel}
        </Button>
      </>
    }
  >
    {children}
  </Dialog>
);
