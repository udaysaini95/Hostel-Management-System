import { ButtonLink, PageHeader, Panel } from "../components/ui/index.js";
import { useAuth } from "../auth/authContext.js";
import { USER_ROLES } from "../auth/roles.js";
import { DashboardMetric } from "../dashboard/DashboardMetric.jsx";
import { DashboardState } from "../dashboard/DashboardState.jsx";
import { formatDashboardDateTime } from "../dashboard/dashboardView.js";
import { useDashboardSummary } from "../dashboard/useDashboardSummary.js";

const ratingValue = (value) => `${value} / 5`;
const percentageValue = (value) => `${value}%`;

const OperationsMetrics = ({ metrics }) => (
  <>
    <div className="hm-dashboard-metrics">
      <DashboardMetric label="Pending leave requests" metric={metrics?.pendingLeaveRequests} />
      <DashboardMetric label="Open complaints" metric={metrics?.openComplaints} />
      <DashboardMetric
        label="Students outside"
        metric={metrics?.studentsOutside}
        tone={metrics?.studentsOutside?.value > 0 ? "warning" : "neutral"}
      />
      <DashboardMetric
        label="Overdue returns"
        metric={metrics?.overdueReturns}
        tone={metrics?.overdueReturns?.value > 0 ? "danger" : "neutral"}
      />
    </div>
    <div className="hm-dashboard-metrics hm-dashboard-metrics--two">
      <DashboardMetric
        label="SLA-breached complaints"
        metric={metrics?.slaBreachedComplaints}
        tone={metrics?.slaBreachedComplaints?.value > 0 ? "danger" : "neutral"}
      />
      <DashboardMetric
        label="Mess rating, last 30 days"
        metric={metrics?.messAverageRating}
        formatValue={ratingValue}
      />
    </div>
  </>
);

const AdminMetrics = ({ metrics }) => (
  <Panel>
    <div className="hm-dashboard-section-heading">
      <div>
        <p className="hm-dashboard-section-heading__eyebrow">Administration</p>
        <h2>Capacity and account health</h2>
      </div>
    </div>
    <div className="hm-dashboard-metrics hm-dashboard-metrics--embedded">
      <DashboardMetric label="All accounts" metric={metrics?.totalUsers} />
      <DashboardMetric label="Active accounts" metric={metrics?.activeUsers} />
      <DashboardMetric label="Active rooms" metric={metrics?.activeRooms} />
      <DashboardMetric
        label="Room occupancy"
        metric={metrics?.roomOccupancy}
        formatValue={percentageValue}
      />
    </div>
    <div className="hm-dashboard-exception-row">
      <div>
        <strong>Audit exceptions in the last 24 hours</strong>
        <p>{metrics?.auditExceptions?.definition ?? "Audit exception data is unavailable."}</p>
      </div>
      <span className="hm-dashboard-exception-row__value">
        {metrics?.auditExceptions?.value ?? "Unavailable"}
      </span>
    </div>
  </Panel>
);

const AdminDashboard = () => {
  const { user } = useAuth();
  const { summary, loading, error, reload } = useDashboardSummary();
  const isAdmin = user.role === USER_ROLES.ADMIN;
  const operations = isAdmin ? summary?.data?.operations : summary?.data;
  const administration = isAdmin ? summary?.data?.administration : null;

  return (
    <div className="hm-page-stack hm-page-stack--wide hm-dashboard">
      <PageHeader
        eyebrow={isAdmin ? "Administrator overview" : "Warden overview"}
        title={isAdmin ? "Institution operations" : "Hostel operations"}
        description={
          isAdmin
            ? "Review current operations, capacity, accounts, and recorded exceptions."
            : "Review queues and exceptions across your assigned hostels."
        }
        actions={<ButtonLink variant="primary" to="/admin/leaves">Review leave requests</ButtonLink>}
      />

      <DashboardState loading={loading} error={error} onRetry={reload} />

      {!loading && !error && summary && (
        <>
          <p className="hm-dashboard-generated">
            Updated {formatDashboardDateTime(summary.generatedAt)}
          </p>
          <OperationsMetrics metrics={operations} />
          {isAdmin && <AdminMetrics metrics={administration} />}
        </>
      )}
    </div>
  );
};

export default AdminDashboard;
