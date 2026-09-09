import api from "../api/axios.js";

export const listMessMenus = async ({ from, to, hostelId }) => {
  const response = await api.get("/api/mess/menus", {
    params: { from, to, hostelId: hostelId || undefined },
  });
  return response.data;
};

export const getMessMenu = async ({ date, hostelId }) => {
  const response = await api.get(`/api/mess/menus/${date}`, {
    params: { hostelId: hostelId || undefined },
  });
  return response.data?.menu ?? null;
};

export const getManageableMessHostels = async () => {
  const response = await api.get("/api/mess/menus/hostels");
  return Array.isArray(response.data?.hostels) ? response.data.hostels : [];
};

export const saveMessMenu = async ({ date, hostelId, meals }) => {
  const response = await api.put(`/api/mess/menus/${date}`, {
    hostelId,
    meals,
  });
  return response.data?.menu ?? null;
};

export const getMyMessIssues = async () => {
  const response = await api.get("/api/mess/my");
  return Array.isArray(response.data) ? response.data : [];
};

export const submitMealFeedback = (payload) =>
  api.post("/api/mess/create", payload);

export const createMessIssue = async (payload) => {
  const response = await api.post("/api/mess/issue/create", payload);
  return response.data;
};

export const getManagedMessIssues = async () => {
  const response = await api.get("/api/mess");
  return Array.isArray(response.data) ? response.data : [];
};

export const updateMessIssueStatus = (issueId, status) =>
  api.put(`/api/mess/${issueId}/status`, { status });

