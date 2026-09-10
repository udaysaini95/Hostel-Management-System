import { useCallback, useEffect, useState } from "react";
import { getApiErrorMessage } from "../api/errors.js";
import { getDashboardSummary } from "./dashboardApi.js";

export const useDashboardSummary = () => {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadDashboard = useCallback(async (signal) => {
    try {
      setLoading(true);
      setError("");
      const result = await getDashboardSummary({ signal });
      if (!result?.data || typeof result.data !== "object") {
        throw new Error("Dashboard response is missing its data payload");
      }
      setSummary(result);
    } catch (requestError) {
      if (requestError?.code === "ERR_CANCELED") return;
      setError(
        getApiErrorMessage(
          requestError,
          "Dashboard data could not be loaded."
        )
      );
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    loadDashboard(controller.signal);
    return () => controller.abort();
  }, [loadDashboard]);

  return {
    summary,
    loading,
    error,
    reload: () => loadDashboard(),
  };
};
