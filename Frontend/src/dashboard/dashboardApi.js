import api from "../api/axios.js";

export const getDashboardSummary = async ({ signal } = {}) => {
  const response = await api.get("/api/dashboard", { signal });
  return response.data;
};
