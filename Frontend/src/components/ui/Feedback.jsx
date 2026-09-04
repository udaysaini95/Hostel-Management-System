import { createElement } from "react";
import { AlertTriangle, Inbox, X } from "lucide-react";
import { Button } from "./Button.jsx";
import { joinClassNames } from "./classNames.js";
import { getToastClassName } from "./primitiveStyles.js";

export const EmptyState = ({
  title,
  description,
  action,
  icon: Icon = Inbox,
  centered = false,
  className,
}) => (
  <section
    className={joinClassNames(
      "hm-feedback-state",
      centered && "hm-feedback-state--centered",
      className
    )}
  >
    {createElement(Icon, {
      className: "hm-feedback-state__icon",
      "aria-hidden": "true",
    })}
    <h2 className="hm-feedback-state__title">{title}</h2>
    {description && (
      <p className="hm-feedback-state__description">{description}</p>
    )}
    {action}
  </section>
);

export const ErrorState = ({
  title = "This content is unavailable",
  description,
  onRetry,
  retryLabel = "Try again",
  centered = false,
  className,
}) => (
  <section
    className={joinClassNames(
      "hm-feedback-state",
      "hm-feedback-state--error",
      centered && "hm-feedback-state--centered",
      className
    )}
    role="alert"
  >
    <AlertTriangle className="hm-feedback-state__icon" aria-hidden="true" />
    <h2 className="hm-feedback-state__title">{title}</h2>
    {description && (
      <p className="hm-feedback-state__description">{description}</p>
    )}
    {onRetry && <Button onClick={onRetry}>{retryLabel}</Button>}
  </section>
);

export const Skeleton = ({ label = "Loading content", className, ...props }) => (
  <span
    {...props}
    role="status"
    aria-label={label}
    className={joinClassNames("hm-skeleton", className)}
  />
);

export const Toast = ({
  tone = "info",
  title,
  message,
  onDismiss,
  closeLabel = "Dismiss notification",
  className,
}) => (
  <section
    className={getToastClassName({ tone, className })}
    role={tone === "danger" ? "alert" : "status"}
    aria-live={tone === "danger" ? "assertive" : "polite"}
  >
    <div className="hm-toast__content">
      <p className="hm-toast__title">{title}</p>
      {message && <p className="hm-toast__message">{message}</p>}
    </div>
    {onDismiss && (
      <Button
        variant="quiet"
        size="icon"
        aria-label={closeLabel}
        onClick={onDismiss}
      >
        <X aria-hidden="true" />
      </Button>
    )}
  </section>
);
