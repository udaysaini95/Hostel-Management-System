import { CalendarDays, Utensils } from "lucide-react";
import { EmptyState, ErrorState, LoadingState, Panel } from "../components/ui/index.js";
import { formatMenuDate, MEAL_SECTIONS } from "./messView.js";

export const MessMenuDetails = ({ date, menu, loading, error, onRetry }) => {
  if (loading) {
    return <LoadingState label="Loading selected menu" rows={4} />;
  }
  if (error) {
    return (
      <ErrorState
        title="Menu could not be loaded"
        description={error}
        onRetry={onRetry}
      />
    );
  }
  if (!menu) {
    return (
      <EmptyState
        icon={CalendarDays}
        title={`No menu published for ${formatMenuDate(date)}`}
        description="The mess team has not published meal information for this date."
      />
    );
  }

  return (
    <Panel className="hm-mess-menu" aria-labelledby="selected-menu-title">
      <div className="hm-mess-menu__heading">
        <div>
          <p className="hm-mess-menu__eyebrow">{menu.hostel?.code}</p>
          <h2 id="selected-menu-title">{formatMenuDate(menu.date)}</h2>
          <p>{menu.hostel?.name}</p>
        </div>
        <span className="hm-mess-menu__version">Version {menu.version}</span>
      </div>

      <div className="hm-mess-menu__meals">
        {MEAL_SECTIONS.map(({ key, label }) => {
          const items = menu.meals?.[key] ?? [];
          return (
            <section key={key} aria-labelledby={`meal-${key}`}>
              <h3 id={`meal-${key}`}><Utensils aria-hidden="true" />{label}</h3>
              {items.length > 0 ? (
                <ul>{items.map((item) => <li key={item}>{item}</li>)}</ul>
              ) : (
                <p className="hm-mess-menu__missing">Not scheduled</p>
              )}
            </section>
          );
        })}
      </div>

      <p className="hm-mess-menu__publication">
        Published by {menu.publishedBy?.name || "mess administration"}
        {menu.publishedAt ? ` · ${new Date(menu.publishedAt).toLocaleString("en-IN")}` : ""}
      </p>
    </Panel>
  );
};
