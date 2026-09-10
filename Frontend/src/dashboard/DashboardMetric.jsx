import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { isDashboardMetric } from "./dashboardView.js";

const defaultFormatter = (value) => String(value);

export const DashboardMetric = ({
  label,
  metric,
  formatValue = defaultFormatter,
  tone = "neutral",
}) => {
  const available = isDashboardMetric(metric);
  const hasData = available && metric.value !== null;

  return (
    <article className={`hm-dashboard-metric hm-dashboard-metric--${tone}`}>
      <p className="hm-dashboard-metric__label">{label}</p>
      <p className="hm-dashboard-metric__value">
        {available ? (hasData ? formatValue(metric.value) : "No data") : "Unavailable"}
      </p>
      <p className="hm-dashboard-metric__definition">
        {available
          ? metric.definition
          : "This metric was not included in the dashboard response."}
      </p>
      {available && metric.href && (
        <Link className="hm-dashboard-metric__link" to={metric.href}>
          View records <ArrowRight aria-hidden="true" />
        </Link>
      )}
    </article>
  );
};
