import { ArrowRight, Wrench } from "lucide-react";
import { Link } from "react-router-dom";
import { ButtonLink, PageHeader, Panel, StatusBadge } from "../components/ui/index.js";
import { DashboardMetric } from "../dashboard/DashboardMetric.jsx";
import { DashboardState } from "../dashboard/DashboardState.jsx";
import { formatDashboardDateTime, formatDashboardStatus } from "../dashboard/dashboardView.js";
import { useDashboardSummary } from "../dashboard/useDashboardSummary.js";

const MaintenanceDashboard = () => {
  const { summary, loading, error, reload } = useDashboardSummary();
  const dashboard = summary?.data;

  return (
    <div className="hm-page-stack hm-page-stack--wide hm-dashboard">
      <PageHeader
        eyebrow="Maintenance overview"
        title="Your active work"
        description="Priorities and SLA risk for complaints currently assigned to you."
        actions={<ButtonLink variant="primary" to="/maintenance/work-orders">Open work queue</ButtonLink>}
      />

      <DashboardState loading={loading} error={error} onRetry={reload} />

      {!loading && !error && dashboard && (
        <>
          <div className="hm-dashboard-metrics hm-dashboard-metrics--three">
            <DashboardMetric label="Assigned work" metric={dashboard.assignedWork} />
            <DashboardMetric
              label="SLA breached"
              metric={dashboard.slaBreachedWork}
              tone={dashboard.slaBreachedWork?.value > 0 ? "danger" : "neutral"}
            />
            <DashboardMetric
              label="High priority"
              metric={dashboard.highPriorityWork}
              tone={dashboard.highPriorityWork?.value > 0 ? "warning" : "neutral"}
            />
          </div>

          <Panel padding="none">
            <div className="hm-dashboard-panel-header">
              <div>
                <p className="hm-dashboard-section-heading__eyebrow">Next work</p>
                <h2>Priority queue</h2>
              </div>
              <Wrench aria-hidden="true" />
            </div>
            {!Array.isArray(dashboard.workItems) ? (
              <p className="hm-dashboard-panel-empty" role="alert">
                Priority queue information is unavailable.
              </p>
            ) : dashboard.workItems.length > 0 ? (
              <div className="hm-dashboard-record-list">
                {dashboard.workItems.map((item) => (
                  <Link key={item.id} to={item.href} className="hm-dashboard-record">
                    <div className="hm-dashboard-record__primary">
                      <strong>Complaint #{item.id} · {item.category}</strong>
                      <span>SLA deadline {formatDashboardDateTime(item.slaDeadline)}</span>
                    </div>
                    <div className="hm-dashboard-record__status">
                      <StatusBadge status={item.slaBreached ? "breached" : item.status}>
                        {item.slaBreached ? "SLA breached" : formatDashboardStatus(item.status)}
                      </StatusBadge>
                      <StatusBadge status={item.priority}>{formatDashboardStatus(item.priority)}</StatusBadge>
                      <ArrowRight aria-hidden="true" />
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="hm-dashboard-panel-empty">No active work is assigned to you.</p>
            )}
          </Panel>
        </>
      )}
    </div>
  );
};

export default MaintenanceDashboard;
