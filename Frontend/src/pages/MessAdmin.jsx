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
import {
  getManagedMessIssues,
  updateMessIssueStatus,
} from "../mess/messApi.js";
import { MessMenuEditor } from "../mess/MessMenuEditor.jsx";

const MessAdmin = () => {
  const [issues, setIssues] = useState([]);
  const [issuesLoading, setIssuesLoading] = useState(true);
  const [issuesError, setIssuesError] = useState("");
  const [updatingIssueId, setUpdatingIssueId] = useState(null);
  const { showToast } = useToast();

  const loadIssues = useCallback(async () => {
    try {
      setIssuesLoading(true);
      setIssuesError("");
      setIssues(await getManagedMessIssues());
    } catch (error) {
      setIssuesError(
        getApiErrorMessage(error, "Reported mess issues could not be loaded.")
      );
    } finally {
      setIssuesLoading(false);
    }
  }, []);

  useEffect(() => {
    loadIssues();
  }, [loadIssues]);

  const handleStatusChange = async (issueId, status) => {
    try {
      setUpdatingIssueId(issueId);
      await updateMessIssueStatus(issueId, status);
      setIssues((current) =>
        current.map((issue) =>
          (issue.id || issue._id) === issueId ? { ...issue, status } : issue
        )
      );
      showToast({
        tone: "success",
        title: "Issue status updated",
        message: `The report is now ${status.toLowerCase()}.`,
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
        description="Publish date-specific menus for each assigned hostel. Updates retain their previous versions."
      />

      <MessMenuEditor />

      <section className="hm-mess-managed-issues" aria-labelledby="managed-mess-issues-title">
        <div className="hm-mess-section-heading">
          <AlertTriangle aria-hidden="true" />
          <div>
            <h2 id="managed-mess-issues-title">Issue queue</h2>
            <p>Menu editing is kept separate from student service reports.</p>
          </div>
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
              const issueId = issue.id || issue._id;
              return (
                <article key={issueId}>
                  <div><strong>{issue.studentName || "Student"}</strong><span>{issue.issueType} · {issue.mealType}</span></div>
                  <p>{issue.description}</p>
                  <Select
                    label="Status"
                    value={issue.status}
                    disabled={updatingIssueId === issueId}
                    onChange={(event) => handleStatusChange(issueId, event.target.value)}
                  >
                    <option>Pending</option>
                    <option>In Progress</option>
                    <option>Resolved</option>
                  </Select>
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
