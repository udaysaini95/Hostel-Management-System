import { forwardRef, useId } from "react";
import { joinClassNames } from "./classNames.js";

const FieldLayout = ({
  id,
  label,
  required,
  hint,
  error,
  className,
  children,
}) => {
  const messageId = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

  return (
    <div className={joinClassNames("hm-field", className)}>
      <div className="hm-field__label-row">
        <label className="hm-field__label" htmlFor={id}>
          {label}
        </label>
        {required && <span className="hm-field__required">Required</span>}
      </div>

      {children(messageId)}

      {(error || hint) && (
        <p
          id={messageId}
          className={joinClassNames(
            "hm-field__message",
            error && "hm-field__message--error"
          )}
          role={error ? "alert" : undefined}
        >
          {error || hint}
        </p>
      )}
    </div>
  );
};

const getDescribedBy = (existingValue, messageId) =>
  [existingValue, messageId].filter(Boolean).join(" ") || undefined;

export const Input = forwardRef(function Input(
  {
    id,
    label,
    hint,
    error,
    required = false,
    startIcon,
    className,
    controlClassName,
    ...inputProps
  },
  ref
) {
  const generatedId = useId();
  const controlId = id || generatedId;

  return (
    <FieldLayout
      id={controlId}
      label={label}
      hint={hint}
      error={error}
      required={required}
      className={className}
    >
      {(messageId) => (
        <div className="hm-field__control-wrap">
          {startIcon && (
            <span className="hm-field__icon" aria-hidden="true">
              {startIcon}
            </span>
          )}
          <input
            {...inputProps}
            ref={ref}
            id={controlId}
            required={required}
            aria-invalid={error ? "true" : undefined}
            aria-describedby={getDescribedBy(
              inputProps["aria-describedby"],
              messageId
            )}
            className={joinClassNames(
              "hm-field__control",
              startIcon && "hm-field__control--with-icon",
              controlClassName
            )}
          />
        </div>
      )}
    </FieldLayout>
  );
});

export const Select = forwardRef(function Select(
  {
    id,
    label,
    hint,
    error,
    required = false,
    className,
    controlClassName,
    children,
    ...selectProps
  },
  ref
) {
  const generatedId = useId();
  const controlId = id || generatedId;

  return (
    <FieldLayout
      id={controlId}
      label={label}
      hint={hint}
      error={error}
      required={required}
      className={className}
    >
      {(messageId) => (
        <select
          {...selectProps}
          ref={ref}
          id={controlId}
          required={required}
          aria-invalid={error ? "true" : undefined}
          aria-describedby={getDescribedBy(
            selectProps["aria-describedby"],
            messageId
          )}
          className={joinClassNames("hm-field__control", controlClassName)}
        >
          {children}
        </select>
      )}
    </FieldLayout>
  );
});

export const Textarea = forwardRef(function Textarea(
  {
    id,
    label,
    hint,
    error,
    required = false,
    className,
    controlClassName,
    ...textareaProps
  },
  ref
) {
  const generatedId = useId();
  const controlId = id || generatedId;

  return (
    <FieldLayout
      id={controlId}
      label={label}
      hint={hint}
      error={error}
      required={required}
      className={className}
    >
      {(messageId) => (
        <textarea
          {...textareaProps}
          ref={ref}
          id={controlId}
          required={required}
          aria-invalid={error ? "true" : undefined}
          aria-describedby={getDescribedBy(
            textareaProps["aria-describedby"],
            messageId
          )}
          className={joinClassNames("hm-field__control", controlClassName)}
        />
      )}
    </FieldLayout>
  );
});
