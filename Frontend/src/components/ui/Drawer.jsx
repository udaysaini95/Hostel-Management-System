import { createPortal } from "react-dom";
import { useId } from "react";
import { X } from "lucide-react";
import { Button } from "./Button.jsx";
import { joinClassNames } from "./classNames.js";
import { useFocusTrap } from "./focusTrap.js";

export const Drawer = ({
  open,
  title,
  description,
  children,
  onDismiss,
  side = "right",
  closeLabel = "Close drawer",
  dismissOnOverlay = true,
  className,
}) => {
  const generatedId = useId();
  const titleId = `${generatedId}-title`;
  const descriptionId = `${generatedId}-description`;
  const { containerRef, handleKeyDown } = useFocusTrap({ open, onDismiss });
  const resolvedSide = side === "left" ? "left" : "right";

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
      className={`hm-overlay hm-drawer-overlay hm-drawer-overlay--${resolvedSide}`}
      onPointerDown={handleOverlayPointerDown}
    >
      <aside
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={joinClassNames("hm-drawer", className)}
        onKeyDown={handleKeyDown}
      >
        <header className="hm-drawer__header">
          <div>
            <h2 id={titleId} className="hm-drawer__title">
              {title}
            </h2>
            {description && (
              <p id={descriptionId} className="hm-drawer__description">
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
        <div className="hm-drawer__body">{children}</div>
      </aside>
    </div>,
    document.body
  );
};
