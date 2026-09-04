import { joinClassNames } from "./classNames.js";

export const BUTTON_VARIANTS = Object.freeze({
  primary: "hm-button--primary",
  secondary: "hm-button--secondary",
  quiet: "hm-button--quiet",
  danger: "hm-button--danger",
  "danger-secondary": "hm-button--danger-secondary",
});

export const BUTTON_SIZES = Object.freeze({
  default: "",
  form: "hm-button--form",
  touch: "hm-button--touch",
  icon: "hm-button--icon",
});

export const BADGE_TONES = Object.freeze({
  neutral: "hm-badge--neutral",
  brand: "hm-badge--brand",
  info: "hm-badge--info",
  success: "hm-badge--success",
  warning: "hm-badge--warning",
  danger: "hm-badge--danger",
});

export const PANEL_VARIANTS = Object.freeze({
  default: "",
  subtle: "hm-panel--subtle",
  selected: "hm-panel--selected",
});

export const PANEL_PADDING = Object.freeze({
  none: "",
  compact: "hm-panel--compact",
  default: "hm-panel--padded",
});

export const TOAST_TONES = Object.freeze({
  info: "",
  success: "hm-toast--success",
  warning: "hm-toast--warning",
  danger: "hm-toast--danger",
});

const STATUS_TONES = Object.freeze({
  approved: "success",
  valid: "success",
  resolved: "success",
  returned: "success",
  completed: "success",
  rejected: "danger",
  invalid: "danger",
  breached: "danger",
  overdue: "danger",
  pending: "warning",
  expiring: "warning",
  assigned: "brand",
  scheduled: "brand",
  created: "info",
  informational: "info",
  "in progress": "info",
  closed: "neutral",
  inactive: "neutral",
  expired: "neutral",
});

const getVariantClass = (variants, value, componentName) => {
  if (!Object.hasOwn(variants, value)) {
    const allowedValues = Object.keys(variants).join(", ");
    throw new Error(
      `${componentName} does not support "${value}". Use one of: ${allowedValues}.`
    );
  }

  return variants[value];
};

export const getButtonClassName = ({
  variant = "secondary",
  size = "default",
  fullWidth = false,
  className,
} = {}) =>
  joinClassNames(
    "hm-button",
    getVariantClass(BUTTON_VARIANTS, variant, "Button variant"),
    getVariantClass(BUTTON_SIZES, size, "Button size"),
    fullWidth && "hm-button--full-width",
    className
  );

export const getBadgeClassName = ({ tone = "neutral", className } = {}) =>
  joinClassNames(
    "hm-badge",
    getVariantClass(BADGE_TONES, tone, "Badge tone"),
    className
  );

export const getPanelClassName = ({
  variant = "default",
  padding = "default",
  className,
} = {}) =>
  joinClassNames(
    "hm-panel",
    getVariantClass(PANEL_VARIANTS, variant, "Panel variant"),
    getVariantClass(PANEL_PADDING, padding, "Panel padding"),
    className
  );

export const getToastClassName = ({ tone = "info", className } = {}) =>
  joinClassNames(
    "hm-toast",
    getVariantClass(TOAST_TONES, tone, "Toast tone"),
    className
  );

export const getStatusTone = (status) => {
  if (typeof status !== "string") {
    return "neutral";
  }

  const normalizedStatus = status.trim().toLowerCase().replaceAll(/[_-]+/g, " ");

  return STATUS_TONES[normalizedStatus] ?? "neutral";
};
