import { useCallback, useEffect, useMemo, useState } from "react";
import { MessageSquareText, Star } from "lucide-react";
import { getApiErrorMessage } from "../api/errors.js";
import {
  EmptyState,
  ErrorState,
  Input,
  LoadingState,
  Panel,
  Select,
} from "../components/ui/index.js";
import {
  getManageableMessHostels,
  getMessFeedbackSummary,
} from "./messApi.js";
import { addCalendarDays, getLocalCalendarDate } from "./messView.js";

const mealLabels = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  snacks: "Snacks",
  dinner: "Dinner",
};

export const MessFeedbackAnalytics = () => {
  const today = useMemo(() => getLocalCalendarDate(), []);
  const [hostels, setHostels] = useState([]);
  const [hostelId, setHostelId] = useState("");
  const [from, setFrom] = useState(() => addCalendarDays(today, -29));
  const [to, setTo] = useState(today);
  const [mealType, setMealType] = useState("");
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    getManageableMessHostels()
      .then((records) => {
        if (!active) return;
        setHostels(records);
        setHostelId(records[0]?.id ? String(records[0].id) : "");
        if (records.length === 0) setLoading(false);
      })
      .catch((requestError) => {
        if (!active) return;
        setError(getApiErrorMessage(requestError, "Hostel assignments could not be loaded."));
        setLoading(false);
      });
    return () => { active = false; };
  }, []);

  const loadSummary = useCallback(async () => {
    if (!hostelId || !from || !to || from > to) return;
    try {
      setLoading(true);
      setError("");
      setSummary(await getMessFeedbackSummary({ hostelId, from, to, mealType }));
    } catch (requestError) {
      setSummary(null);
      setError(getApiErrorMessage(requestError, "Feedback analytics could not be loaded."));
    } finally {
      setLoading(false);
    }
  }, [from, hostelId, mealType, to]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  return (
    <section className="hm-mess-analytics" aria-labelledby="mess-feedback-title">
      <div className="hm-mess-section-heading">
        <Star aria-hidden="true" />
        <div>
          <h2 id="mess-feedback-title">Meal feedback</h2>
          <p>Real student ratings for published meals, kept within each hostel.</p>
        </div>
      </div>

      <Panel className="hm-mess-analytics__panel">
        <div className="hm-mess-analytics__filters">
          <Select label="Hostel" value={hostelId} onChange={(event) => setHostelId(event.target.value)}>
            {hostels.map((hostel) => (
              <option key={hostel.id} value={hostel.id}>{hostel.code} · {hostel.name}</option>
            ))}
          </Select>
          <Input label="From" type="date" value={from} max={to} onChange={(event) => setFrom(event.target.value)} />
          <Input label="To" type="date" value={to} min={from} onChange={(event) => setTo(event.target.value)} />
          <Select label="Meal" value={mealType} onChange={(event) => setMealType(event.target.value)}>
            <option value="">All meals</option>
            {Object.entries(mealLabels).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </Select>
        </div>

        {loading ? (
          <LoadingState label="Loading meal feedback" rows={3} compact />
        ) : error ? (
          <ErrorState title="Feedback is unavailable" description={error} onRetry={loadSummary} />
        ) : !summary?.overall?.responseCount ? (
          <EmptyState
            icon={MessageSquareText}
            title="No feedback in this period"
            description="The score will appear after a student rates a published meal."
          />
        ) : (
          <div className="hm-mess-analytics__results">
            <div className="hm-mess-analytics__score">
              <span>Average rating</span>
              <strong>{summary.overall.averageRating} <small>/ 5</small></strong>
              <p>{summary.overall.responseCount} response{summary.overall.responseCount === 1 ? "" : "s"}</p>
            </div>
            <div className="hm-mess-analytics__meals" aria-label="Ratings by meal">
              {summary.byMeal.map((meal) => (
                <div key={meal.mealType}>
                  <span>{mealLabels[meal.mealType]}</span>
                  <strong>{meal.averageRating} / 5</strong>
                  <small>{meal.responseCount} response{meal.responseCount === 1 ? "" : "s"}</small>
                </div>
              ))}
            </div>
            {summary.recentComments.length > 0 && (
              <div className="hm-mess-analytics__comments">
                <h3>Recent comments</h3>
                {summary.recentComments.map((comment) => (
                  <article key={comment.id}>
                    <div>
                      <strong>{comment.studentName}</strong>
                      <span>{mealLabels[comment.mealType]} · {comment.menuDate} · {comment.rating}/5</span>
                    </div>
                    <p>{comment.comment}</p>
                  </article>
                ))}
              </div>
            )}
          </div>
        )}
      </Panel>
    </section>
  );
};
