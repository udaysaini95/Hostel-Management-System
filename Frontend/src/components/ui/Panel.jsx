import { createElement } from "react";
import { getPanelClassName } from "./primitiveStyles.js";

export const Panel = ({
  as: Element = "section",
  variant = "default",
  padding = "default",
  className,
  children,
  ...props
}) =>
  createElement(
    Element,
    {
      ...props,
      className: getPanelClassName({ variant, padding, className }),
    },
    children
  );
