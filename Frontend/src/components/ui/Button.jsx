import { forwardRef } from "react";
import { LoaderCircle } from "lucide-react";
import { getButtonClassName } from "./primitiveStyles.js";

export const Button = forwardRef(function Button(
  {
    variant = "secondary",
    size = "default",
    fullWidth = false,
    loading = false,
    loadingLabel,
    leadingIcon,
    className,
    children,
    disabled,
    type = "button",
    ...buttonProps
  },
  ref
) {
  return (
    <button
      {...buttonProps}
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={getButtonClassName({ variant, size, fullWidth, className })}
    >
      {loading ? (
        <LoaderCircle className="hm-button__spinner" aria-hidden="true" />
      ) : (
        leadingIcon
      )}
      <span>{loading && loadingLabel ? loadingLabel : children}</span>
    </button>
  );
});
