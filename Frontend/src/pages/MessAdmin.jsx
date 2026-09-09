import { useCallback, useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { getApiErrorMessage } from "../api/errors.js";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  Select,
} from "../components/ui/index.js";
import { useToast } from "../feedback/toastContext.js";
import { MessFeedbackAnalytics } from "../mess/MessFeedbackAnalytics.jsx";
import { MessIssueEvidenceButton } from "../mess/MessIssueEvidenceButton.jsx";
import {
  getManageableMessHostels,
  getManagedMessIssues,
  updateMessIssueStatus,
} from "../mess/messApi.js";
import { MessMenuEditor } from "../mess/MessMenuEditor.jsx";

const issueTypeLabels = {
  food_quality: "Food quality",
  hygiene: "Hygiene",
  quantity: "Quantity",
  staff_behavior: "Staff behavior",
  other: "Other",
};
const mealLabels = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  snacks: "Snacks",
  dinner: "Dinner",
};
const statusLabels = {
  reported: "Reported",
  in_progress: "In progress",
  resolved: "Resolved",
};
const nextStatus = {
  reported: "in_progress",
  in_progress: "resolved",
};

const MessAdmin = () => {
  const [issues, setIssues] = useState([]);
  const [hostels, setHostels] = useState([]);
  const [hostelId, setHostelId] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [issuesLoading, setIssuesLoading] = useState(true);
  const [issuesError, setIssuesError] = useState("");
  const [updatingIssueId, setUpdatingIssueId] = useState(null);
  const { showToast } = useToast();

  const loadIssues = useCallback(async () => {
    try {
      setIssuesLoading(true);
      setIssuesError("");
      const result = await getManagedMessIssues({
        hostelId: hostelId || undefined,
        status: statusFilter || undefined,
      });
      setIssues(Array.isArray(result?.data) ? result.data : []);
    } catch (error) {
      setIssuesError(
        getApiErrorMessage(error, "Reported mess issues could not be loaded.")
      );
    } finally {
      setIssuesLoading(false);
    }
  }, [hostelId, statusFilter]);

  useEffect(() => {
    loadIssues();
  }, [loadIssues]);

  useEffect(() => {
    getManageableMessHostels().then(setHostels).catch(() => setHostels([]));
  }, []);

  const handleStatusChange = async (issueId, status) => {
    try {
      setUpdatingIssueId(issueId);
      const updated = await updateMessIssueStatus(issueId, status);
      setIssues((current) =>
        current.map((issue) => issue.id === issueId ? updated : issue)
      );
      showToast({
        tone: "success",
        title: "Issue status updated",
        message: `The report is now ${statusLabels[status].toLowerCase()}.`,
      });
    } catch (error) {
      showToast({
        tone: "danger",
        title: "Issue was not updated",
        message: getApiErrorMessage(error, "Try again in a moment."),
      });
    } finally {
      setUpdatingIssueId(null);
    }
  };

  return (
    <div className="hm-page-stack hm-page-stack--wide hm-mess-page">
      <PageHeader
        eyebrow="Mess administration"
        title="Menu schedule"
        description="Publish menus, review meal feedback, and resolve student mess issues."
      />

      <MessMenuEditor />
      <MessFeedbackAnalytics />

      <section className="hm-mess-managed-issues" aria-labelledby="managed-mess-issues-title">
        <div className="hm-mess-section-heading">
          <AlertTriangle aria-hidden="true" />
          <div>
            <h2 id="managed-mess-issues-title">Issue queue</h2>
            <p>Review hostel-scoped reports and move each issue through its permitted states.</p>
          </div>
        </div>

        <div className="hm-mess-issue-filters">
          <Select label="Hostel" value={hostelId} onChange={(event) => setHostelId(event.target.value)}>
            <option value="">All assigned hostels</option>
            {hostels.map((hostel) => (
              <option key={hostel.id} value={hostel.id}>{hostel.code} · {hostel.name}</option>
            ))}
          </Select>
          <Select label="Status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="">All statuses</option>
            {Object.entries(statusLabels).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </Select>
        </div>

        {issuesLoading ? (
          <LoadingState label="Loading reported mess issues" rows={3} compact />
        ) : issuesError ? (
          <ErrorState title="Mess issues are unavailable" description={issuesError} onRetry={loadIssues} />
        ) : issues.length === 0 ? (
          <EmptyState icon={AlertTriangle} title="No reported mess issues" description="Student reports will appear here for review." />
        ) : (
          <div className="hm-mess-issue-list">
            {issues.map((issue) => {
              const permittedNextStatus = nextStatus[issue.status];
              return (
                <article key={issue.id}>
                  <div>
                    <strong>{issue.student.name}</strong>
                    <span>
                      {issue.hostel.code} · {issueTypeLabels[issue.issueType]} · {mealLabels[issue.mealType]}
                    </span>
                  </div>
                  <p>{issue.description}</p>
                  <div className="hm-mess-issue-list__actions">
                    <Select
                      label="Status"
                      value={issue.status}
                      disabled={!permittedNextStatus || updatingIssueId === issue.id}
                      onChange={(event) => handleStatusChange(issue.id, event.target.value)}
                    >
                      <option value={issue.status}>{statusLabels[issue.status]}</option>
                      {permittedNextStatus && (
                        <option value={permittedNextStatus}>{statusLabels[permittedNextStatus]}</option>
                      )}
                    </Select>
                    <MessIssueEvidenceButton issue={issue} />
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};

export default MessAdmin;
