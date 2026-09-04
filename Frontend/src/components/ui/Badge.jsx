import { getBadgeClassName, getStatusTone } from "./primitiveStyles.js";

export const Badge = ({ tone = "neutral", className, children, ...props }) => (
  <span {...props} className={getBadgeClassName({ tone, className })}>
    {children}
  </span>
);

export const StatusBadge = ({ status, className, children, ...props }) => (
  <Badge
    {...props}
    tone={getStatusTone(status)}
    className={className}
    data-status={status}
  >
    {children ?? status}
  </Badge>
);
