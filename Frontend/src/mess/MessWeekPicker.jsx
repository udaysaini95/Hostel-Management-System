import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  formatMenuDate,
  getCalendarDates,
  getLocalCalendarDate,
} from "./messView.js";

export const MessWeekPicker = ({
  startDate,
  selectedDate,
  publishedDates = new Set(),
  onSelect,
  onPrevious,
  onNext,
}) => {
  const today = getLocalCalendarDate();
  const dates = getCalendarDates(startDate);

  return (
    <div className="hm-mess-calendar" aria-label="Menu date navigation">
      <div className="hm-mess-calendar__heading">
        <div>
          <h2>Seven-day menu</h2>
          <p>
            {formatMenuDate(dates[0], { day: "numeric", month: "short" })}
            {" – "}
            {formatMenuDate(dates[6])}
          </p>
        </div>
        <div className="hm-mess-calendar__navigation">
          <button type="button" onClick={onPrevious} aria-label="Show previous seven days">
            <ChevronLeft aria-hidden="true" />
          </button>
          <button type="button" onClick={onNext} aria-label="Show next seven days">
            <ChevronRight aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="hm-mess-calendar__days">
        {dates.map((date) => {
          const published = publishedDates.has(date);
          return (
            <button
              type="button"
              key={date}
              className={date === selectedDate ? "is-selected" : undefined}
              aria-pressed={date === selectedDate}
              onClick={() => onSelect(date)}
            >
              <span>{formatMenuDate(date, { weekday: "short", day: undefined, month: undefined, year: undefined })}</span>
              <strong>{date.slice(-2)}</strong>
              <small>{date === today ? "Today" : published ? "Published" : "No menu"}</small>
            </button>
          );
        })}
      </div>
    </div>
  );
};

