import { ArrowRight, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { ButtonLink, PageHeader, Panel, StatusBadge } from "../components/ui/index.js";
import { DashboardMetric } from "../dashboard/DashboardMetric.jsx";
import { DashboardState } from "../dashboard/DashboardState.jsx";
import { formatDashboardDateTime, formatDashboardStatus } from "../dashboard/dashboardView.js";
import { useDashboardSummary } from "../dashboard/useDashboardSummary.js";

const GuardDashboard = () => {
  const { summary, loading, error, reload } = useDashboardSummary();
  const dashboard = summary?.data;

  return (
    <div className="hm-page-stack hm-page-stack--wide hm-dashboard">
      <PageHeader
        eyebrow="Gate security overview"
        title="Gate activity"
        description="Review outside residents and recent recorded movements before opening the terminal."
        actions={<ButtonLink variant="primary" to="/guard/terminal">Open gate terminal</ButtonLink>}
      />

      <DashboardState loading={loading} error={error} onRetry={reload} />

      {!loading && !error && dashboard && (
        <>
          <div className="hm-dashboard-metrics hm-dashboard-metrics--two">
            <DashboardMetric label="Students outside" metric={dashboard.studentsOutside} />
            <DashboardMetric
              label="Overdue returns"
              metric={dashboard.overdueReturns}
              tone={dashboard.overdueReturns?.value > 0 ? "danger" : "neutral"}
            />
          </div>

          <Panel padding="none">
            <div className="hm-dashboard-panel-header">
              <div>
                <p className="hm-dashboard-section-heading__eyebrow">Recorded at assigned hostels</p>
                <h2>Recent movements</h2>
              </div>
              <ShieldCheck aria-hidden="true" />
            </div>
            {!Array.isArray(dashboard.recentMovements) ? (
              <p className="hm-dashboard-panel-empty" role="alert">
                Recent movement information is unavailable.
              </p>
            ) : dashboard.recentMovements.length > 0 ? (
              <div className="hm-dashboard-record-list">
                {dashboard.recentMovements.map((movement) => (
                  <Link key={movement.id} to={movement.href} className="hm-dashboard-record">
                    <div className="hm-dashboard-record__primary">
                      <strong>{movement.student.name}</strong>
                      <span>{movement.student.rollNo} · {movement.hostelCode}</span>
                    </div>
                    <div className="hm-dashboard-record__status">
                      <StatusBadge status={movement.movement}>
                        {formatDashboardStatus(movement.movement)}
                      </StatusBadge>
                      <time dateTime={movement.occurredAt}>
                        {formatDashboardDateTime(movement.occurredAt)}
                      </time>
                      <ArrowRight aria-hidden="true" />
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="hm-dashboard-panel-empty">No gate movements have been recorded yet.</p>
            )}
          </Panel>
        </>
      )}
    </div>
  );
};

export default GuardDashboard;
