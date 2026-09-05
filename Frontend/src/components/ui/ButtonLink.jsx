import { forwardRef } from "react";
import { Link } from "react-router-dom";
import { getButtonClassName } from "./primitiveStyles.js";

export const ButtonLink = forwardRef(function ButtonLink(
  {
    variant = "secondary",
    size = "default",
    fullWidth = false,
    className,
    children,
    ...linkProps
  },
  ref
) {
  return (
    <Link
      {...linkProps}
      ref={ref}
      className={getButtonClassName({ variant, size, fullWidth, className })}
    >
      {children}
    </Link>
  );
});
