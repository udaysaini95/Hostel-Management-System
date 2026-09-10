import { Bell, ClipboardList, FileCheck2, Utensils } from "lucide-react";
import { ButtonLink, PageHeader, Panel, StatusBadge } from "../components/ui/index.js";
import { DashboardMetric } from "../dashboard/DashboardMetric.jsx";
import { DashboardState } from "../dashboard/DashboardState.jsx";
import {
  formatDashboardDateTime,
  formatDashboardStatus,
  groupMenuItems,
  isDashboardMetric,
} from "../dashboard/dashboardView.js";
import { useDashboardSummary } from "../dashboard/useDashboardSummary.js";

const StudentDashboard = () => {
  const { summary, loading, error, reload } = useDashboardSummary();
  const dashboard = summary?.data;
  const leave = dashboard?.latestLeave?.value;
  const menu = dashboard?.todayMenu?.value;
  const menuGroups = groupMenuItems(menu?.items);
  const leaveAvailable = isDashboardMetric(dashboard?.latestLeave);
  const menuAvailable = isDashboardMetric(dashboard?.todayMenu);
  const overdue = leave?.status === "exited" &&
    new Date(leave.expectedReturnAt).getTime() < new Date(summary.generatedAt).getTime();

  return (
    <div className="hm-page-stack hm-page-stack--wide hm-dashboard">
      <PageHeader
        eyebrow="Student overview"
        title="Your hostel today"
        description="Check the requests and information that need your attention."
        actions={
          <>
            <ButtonLink variant="primary" to="/student/complaints/raise">
              Raise complaint
            </ButtonLink>
            <ButtonLink to="/student/leaves/apply">Apply for leave</ButtonLink>
          </>
        }
      />

      <DashboardState loading={loading} error={error} onRetry={reload} />

      {!loading && !error && dashboard && (
        <>
          <Panel className={`hm-dashboard-focus${overdue ? " hm-dashboard-focus--danger" : ""}`}>
            {leaveAvailable ? (
              <>
              <div className="hm-dashboard-section-heading">
                <div>
                  <p className="hm-dashboard-section-heading__eyebrow">Latest leave request</p>
                  <h2>
                    {leave
                      ? overdue
                        ? "Your expected return time has passed"
                        : "Current leave status"
                      : "No leave requests submitted"}
                  </h2>
                </div>
                {leave && (
                  <StatusBadge status={overdue ? "overdue" : leave.status}>
                    {overdue ? "Overdue" : formatDashboardStatus(leave.status)}
                  </StatusBadge>
                )}
              </div>
              {leave ? (
                <dl className="hm-dashboard-details">
                  <div>
                    <dt>Departure</dt>
                    <dd>{formatDashboardDateTime(leave.departureAt)}</dd>
                  </div>
                  <div>
                    <dt>Expected return</dt>
                    <dd>{formatDashboardDateTime(leave.expectedReturnAt)}</dd>
                  </div>
                  <div>
                    <dt>Gate pass</dt>
                    <dd>{leave.gatePass ? "Issued" : "Not issued"}</dd>
                  </div>
                </dl>
              ) : (
                <p className="hm-dashboard-empty-copy">
                  Apply for leave when you need permission to leave campus.
                </p>
              )}
              <ButtonLink to={dashboard.latestLeave.href}>View leave and gate pass</ButtonLink>
              </>
            ) : (
              <p className="hm-dashboard-empty-copy" role="alert">
                Leave information is unavailable. Refresh the dashboard to try again.
              </p>
            )}
          </Panel>

          <div className="hm-dashboard-metrics hm-dashboard-metrics--two">
            <DashboardMetric
              label="Active complaints"
              metric={dashboard.activeComplaints}
              tone={dashboard.activeComplaints?.value > 0 ? "warning" : "neutral"}
            />
            <DashboardMetric
              label="Unread notices"
              metric={dashboard.unreadNotices}
              tone={dashboard.unreadNotices?.value > 0 ? "info" : "neutral"}
            />
          </div>

          <div className="hm-dashboard-columns">
            <Panel>
              <div className="hm-dashboard-section-heading">
                <div>
                  <p className="hm-dashboard-section-heading__eyebrow">Mess</p>
                  <h2>Today&apos;s menu</h2>
                </div>
                <Utensils aria-hidden="true" />
              </div>
              {!menuAvailable ? (
                <p className="hm-dashboard-empty-copy" role="alert">
                  Menu information is unavailable. Refresh the dashboard to try again.
                </p>
              ) : menuGroups.length > 0 ? (
                <div className="hm-dashboard-menu">
                  {menuGroups.map((group) => (
                    <div key={group.mealType}>
                      <h3>{formatDashboardStatus(group.mealType)}</h3>
                      <p>{group.names.join(", ")}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="hm-dashboard-empty-copy">No menu has been published for today.</p>
              )}
              {menuAvailable && (
                <ButtonLink to={dashboard.todayMenu.href}>Open mess menu</ButtonLink>
              )}
            </Panel>

            <Panel>
              <div className="hm-dashboard-section-heading">
                <div>
                  <p className="hm-dashboard-section-heading__eyebrow">Quick access</p>
                  <h2>Student records</h2>
                </div>
                <ClipboardList aria-hidden="true" />
              </div>
              <nav className="hm-dashboard-link-list" aria-label="Student record shortcuts">
                <ButtonLink to="/student/complaints">
                  <ClipboardList aria-hidden="true" /> View complaints
                </ButtonLink>
                <ButtonLink to="/student/leaves">
                  <FileCheck2 aria-hidden="true" /> View leave requests
                </ButtonLink>
                <ButtonLink to="/notices">
                  <Bell aria-hidden="true" /> Read notices
                </ButtonLink>
              </nav>
            </Panel>
          </div>
        </>
      )}
    </div>
  );
};

export default StudentDashboard;
