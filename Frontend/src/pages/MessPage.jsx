import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, Star, Utensils } from "lucide-react";
import { getApiErrorMessage } from "../api/errors.js";
import {
  Button,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  Panel,
  Select,
  Textarea,
} from "../components/ui/index.js";
import { useToast } from "../feedback/toastContext.js";
import {
  createMessIssue,
  getMyMessIssues,
  submitMealFeedback,
} from "../mess/messApi.js";
import { MessMenuBrowser } from "../mess/MessMenuBrowser.jsx";
import { MessIssueEvidenceButton } from "../mess/MessIssueEvidenceButton.jsx";

const ISSUE_TYPES = {
  food_quality: "Food quality",
  hygiene: "Hygiene",
  quantity: "Quantity",
  staff_behavior: "Staff behavior",
  other: "Other",
};
const STATUS_LABELS = {
  reported: "Reported",
  in_progress: "In progress",
  resolved: "Resolved",
};
const MEAL_LABELS = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  snacks: "Snacks",
  dinner: "Dinner",
};

const MessPage = () => {
  const [rating, setRating] = useState("5");
  const [mealType, setMealType] = useState("breakfast");
  const [feedbackComment, setFeedbackComment] = useState("");
  const [menuSelection, setMenuSelection] = useState({
    date: "",
    menu: null,
    loading: true,
  });
  const [issueType, setIssueType] = useState("food_quality");
  const [issueMealType, setIssueMealType] = useState("breakfast");
  const [issueDescription, setIssueDescription] = useState("");
  const [issueEvidence, setIssueEvidence] = useState(null);
  const [evidenceError, setEvidenceError] = useState("");
  const [issues, setIssues] = useState([]);
  const [issuesLoading, setIssuesLoading] = useState(true);
  const [issuesError, setIssuesError] = useState("");
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [issueLoading, setIssueLoading] = useState(false);
  const { showToast } = useToast();
  const evidenceInput = useRef(null);

  const loadIssues = useCallback(async () => {
    try {
      setIssuesLoading(true);
      setIssuesError("");
      const result = await getMyMessIssues();
      setIssues(Array.isArray(result?.data) ? result.data : []);
    } catch (error) {
      setIssuesError(
        getApiErrorMessage(error, "Your mess issue history could not be loaded.")
      );
    } finally {
      setIssuesLoading(false);
    }
  }, []);

  useEffect(() => {
    loadIssues();
  }, [loadIssues]);

  const handleMenuSelection = useCallback((selection) => {
    setMenuSelection(selection);
    const availableMeals = Object.keys(selection.menu?.meals || {}).filter(
      (meal) => selection.menu.meals[meal]?.length > 0
    );
    setMealType((current) =>
      availableMeals.includes(current) ? current : (availableMeals[0] || "breakfast")
    );
  }, []);

  const handleFeedbackSubmit = async (event) => {
    event.preventDefault();
    if (!menuSelection.menu) return;
    try {
      setFeedbackLoading(true);
      await submitMealFeedback({
        menuId: menuSelection.menu.id,
        rating: Number(rating),
        mealType,
        comment: feedbackComment.trim() || undefined,
      });
      setFeedbackComment("");
      showToast({
        tone: "success",
        title: "Rating submitted",
        message: `${MEAL_LABELS[mealType]} was rated ${rating} out of 5.`,
      });
    } catch (error) {
      showToast({
        tone: "danger",
        title: "Rating was not submitted",
        message: getApiErrorMessage(error, "Try again in a moment."),
      });
    } finally {
      setFeedbackLoading(false);
    }
  };

  const handleIssueSubmit = async (event) => {
    event.preventDefault();
    if (!issueDescription.trim()) return;
    try {
      setIssueLoading(true);
      const issue = await createMessIssue({
        issueType,
        mealType: issueMealType,
        description: issueDescription.trim(),
        evidence: issueEvidence,
      });
      setIssues((current) => [issue, ...current]);
      setIssueDescription("");
      setIssueEvidence(null);
      setEvidenceError("");
      if (evidenceInput.current) evidenceInput.current.value = "";
      showToast({
        tone: "success",
        title: "Mess issue reported",
        message: "You can follow its status in your issue history.",
      });
    } catch (error) {
      showToast({
        tone: "danger",
        title: "Issue was not reported",
        message: getApiErrorMessage(error, "Try again in a moment."),
      });
    } finally {
      setIssueLoading(false);
    }
  };

  const selectEvidence = (event) => {
    const file = event.target.files?.[0] || null;
    setEvidenceError("");
    if (!file) {
      setIssueEvidence(null);
      return;
    }
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setIssueEvidence(null);
      setEvidenceError("Choose a JPEG, PNG, or WebP image.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setIssueEvidence(null);
      setEvidenceError("Evidence must be 5 MB or smaller.");
      return;
    }
    setIssueEvidence(file);
  };

  return (
    <div className="hm-page-stack hm-page-stack--wide hm-mess-page">
      <PageHeader
        eyebrow="Dining operations"
        title="Mess menu"
        description="Check published meals by date, share a rating, or report a service issue."
      />

      <MessMenuBrowser onSelectionChange={handleMenuSelection} />

      <div className="hm-mess-actions">
        <Panel as="form" className="hm-mess-feedback" onSubmit={handleFeedbackSubmit}>
          <div className="hm-mess-section-heading">
            <Star aria-hidden="true" />
            <div>
              <h2>Rate a meal</h2>
              <p>
                {menuSelection.menu
                  ? `${menuSelection.menu.hostel.name} · ${menuSelection.date}`
                  : "Select a date with a published menu."}
              </p>
            </div>
          </div>
          <Select
            label="Meal"
            value={mealType}
            disabled={!menuSelection.menu}
            onChange={(event) => setMealType(event.target.value)}
          >
            {Object.entries(MEAL_LABELS)
              .filter(([meal]) => menuSelection.menu?.meals?.[meal]?.length > 0)
              .map(([meal, label]) => <option key={meal} value={meal}>{label}</option>)}
          </Select>
          <Select
            label={`Rating: ${rating} out of 5`}
            value={rating}
            onChange={(event) => setRating(event.target.value)}
          >
            {[1, 2, 3, 4, 5].map((score) => (
              <option key={score} value={score}>{score} out of 5</option>
            ))}
          </Select>
          <Textarea
            label="Comment (optional)"
            rows={3}
            maxLength={1000}
            value={feedbackComment}
            onChange={(event) => setFeedbackComment(event.target.value)}
            hint={`${feedbackComment.length}/1000 characters`}
          />
          <Button
            type="submit"
            disabled={!menuSelection.menu || menuSelection.loading}
            loading={feedbackLoading}
            loadingLabel="Submitting rating"
          >
            Submit rating
          </Button>
        </Panel>

        <Panel as="form" className="hm-mess-report" onSubmit={handleIssueSubmit}>
          <div className="hm-mess-section-heading">
            <AlertTriangle aria-hidden="true" />
            <div><h2>Report an issue</h2><p>Give the mess team enough detail to respond.</p></div>
          </div>
          <Select label="Issue type" value={issueType} onChange={(event) => setIssueType(event.target.value)}>
            {Object.entries(ISSUE_TYPES).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </Select>
          <Select
            label="Affected meal"
            value={issueMealType}
            onChange={(event) => setIssueMealType(event.target.value)}
          >
            {Object.entries(MEAL_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </Select>
          <Textarea
            label="Description"
            rows={4}
            minLength={10}
            maxLength={2000}
            required
            value={issueDescription}
            onChange={(event) => setIssueDescription(event.target.value)}
            hint="Describe what happened and which meal was affected."
          />
          <div className="hm-mess-evidence-field">
            <div><label htmlFor="mess-issue-evidence">Photo evidence</label><span>Optional</span></div>
            <p>JPEG, PNG, or WebP. Maximum 5 MB.</p>
            <input
              ref={evidenceInput}
              id="mess-issue-evidence"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              aria-describedby={evidenceError ? "mess-evidence-error" : undefined}
              aria-invalid={Boolean(evidenceError)}
              onChange={selectEvidence}
            />
            {evidenceError && <p id="mess-evidence-error" className="hm-mess-evidence-field__error" role="alert">{evidenceError}</p>}
          </div>
          <Button type="submit" loading={issueLoading} loadingLabel="Reporting issue">
            Report issue
          </Button>
        </Panel>
      </div>

      <section className="hm-mess-issues" aria-labelledby="my-mess-issues-title">
        <div className="hm-mess-section-heading">
          <Utensils aria-hidden="true" />
          <div><h2 id="my-mess-issues-title">My mess issues</h2><p>Recent reports and their current status.</p></div>
        </div>
        {issuesLoading ? (
          <LoadingState label="Loading mess issue history" rows={3} compact />
        ) : issuesError ? (
          <ErrorState title="Issue history is unavailable" description={issuesError} onRetry={loadIssues} />
        ) : issues.length === 0 ? (
          <EmptyState icon={Utensils} title="No mess issues reported" description="Reports you submit will appear here." />
        ) : (
          <div className="hm-mess-issue-list">
            {issues.map((issue) => (
              <article key={issue.id || issue._id}>
                <div>
                  <strong>{ISSUE_TYPES[issue.issueType]}</strong>
                  <span>{MEAL_LABELS[issue.mealType]} · {issue.hostel.code}</span>
                </div>
                <p>{issue.description}</p>
                <div className="hm-mess-issue-list__actions">
                  <span className="hm-mess-issue-list__status">{STATUS_LABELS[issue.status]}</span>
                  <MessIssueEvidenceButton issue={issue} />
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default MessPage;
