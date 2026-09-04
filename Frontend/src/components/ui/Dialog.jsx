import { createPortal } from "react-dom";
import { useId } from "react";
import { X } from "lucide-react";
import { Button } from "./Button.jsx";
import { joinClassNames } from "./classNames.js";
import { useFocusTrap } from "./focusTrap.js";

export const Dialog = ({
  open,
  title,
  description,
  children,
  footer,
  onDismiss,
  closeLabel = "Close dialog",
  dismissOnOverlay = false,
  className,
}) => {
  const generatedId = useId();
  const titleId = `${generatedId}-title`;
  const descriptionId = `${generatedId}-description`;
  const { containerRef, handleKeyDown } = useFocusTrap({ open, onDismiss });

  if (!open) {
    return null;
  }

  const handleOverlayPointerDown = (event) => {
    if (dismissOnOverlay && event.target === event.currentTarget) {
      onDismiss();
    }
  };

  return createPortal(
    <div
      className="hm-overlay hm-dialog-overlay"
      onPointerDown={handleOverlayPointerDown}
    >
      <section
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={joinClassNames("hm-dialog", className)}
        onKeyDown={handleKeyDown}
      >
        <header className="hm-dialog__header">
          <div>
            <h2 id={titleId} className="hm-dialog__title">
              {title}
            </h2>
            {description && (
              <p id={descriptionId} className="hm-dialog__description">
                {description}
              </p>
            )}
          </div>
          <Button
            variant="quiet"
            size="icon"
            aria-label={closeLabel}
            onClick={onDismiss}
          >
            <X aria-hidden="true" />
          </Button>
        </header>

        <div className="hm-dialog__body">{children}</div>
        {footer && <footer className="hm-dialog__footer">{footer}</footer>}
      </section>
    </div>,
    document.body
  );
};
