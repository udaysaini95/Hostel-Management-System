import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getApiErrorMessage } from "../api/errors.js";
import { listMessMenus } from "./messApi.js";
import { MessMenuDetails } from "./MessMenuDetails.jsx";
import { MessWeekPicker } from "./MessWeekPicker.jsx";
import {
  addCalendarDays,
  getCalendarRange,
  getLocalCalendarDate,
  menuByDate,
} from "./messView.js";

export const MessMenuBrowser = ({ hostelId }) => {
  const today = useMemo(() => getLocalCalendarDate(), []);
  const [startDate, setStartDate] = useState(today);
  const [selectedDate, setSelectedDate] = useState(today);
  const [menus, setMenus] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const latestRequest = useRef(0);

  const loadMenus = useCallback(async () => {
    const requestId = latestRequest.current + 1;
    latestRequest.current = requestId;
    try {
      setLoading(true);
      setError("");
      const result = await listMessMenus({
        ...getCalendarRange(startDate),
        hostelId,
      });
      if (latestRequest.current === requestId) {
        setMenus(Array.isArray(result?.menus) ? result.menus : []);
      }
    } catch (requestError) {
      if (latestRequest.current === requestId) {
        setMenus([]);
        setError(
          getApiErrorMessage(requestError, "The menu calendar is temporarily unavailable.")
        );
      }
    } finally {
      if (latestRequest.current === requestId) setLoading(false);
    }
  }, [hostelId, startDate]);

  useEffect(() => {
    loadMenus();
  }, [loadMenus]);

  const menusByDate = useMemo(() => menuByDate(menus), [menus]);
  const navigateWeek = (amount) => {
    const nextStart = addCalendarDays(startDate, amount);
    setStartDate(nextStart);
    setSelectedDate(nextStart);
  };

  return (
    <section className="hm-mess-browser" aria-label="Published mess menus">
      <MessWeekPicker
        startDate={startDate}
        selectedDate={selectedDate}
        publishedDates={new Set(menusByDate.keys())}
        onSelect={setSelectedDate}
        onPrevious={() => navigateWeek(-7)}
        onNext={() => navigateWeek(7)}
      />
      <MessMenuDetails
        date={selectedDate}
        menu={menusByDate.get(selectedDate)}
        loading={loading}
        error={error}
        onRetry={loadMenus}
      />
    </section>
  );
};

