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

export const getMyMessIssues = async ({ page = 1, status } = {}) => {
  const response = await api.get("/api/mess/issues/mine", {
    params: { page, pageSize: 20, status: status || undefined },
  });
  return response.data;
};

export const submitMealFeedback = (payload) =>
  api.post("/api/mess/feedback", payload);

export const getMessFeedbackSummary = async ({ hostelId, from, to, mealType }) => {
  const response = await api.get("/api/mess/feedback/summary", {
    params: { hostelId, from, to, mealType: mealType || undefined },
  });
  return response.data;
};

export const createMessIssue = async ({ issueType, mealType, description, evidence }) => {
  const body = new FormData();
  body.append("issueType", issueType);
  body.append("mealType", mealType);
  body.append("description", description);
  if (evidence) body.append("evidence", evidence);

  const response = await api.post("/api/mess/issues", body);
  return response.data?.issue;
};

export const getManagedMessIssues = async ({ page = 1, ...filters } = {}) => {
  const response = await api.get("/api/mess/issues/managed", {
    params: { page, pageSize: 20, ...filters },
  });
  return response.data;
};

export const updateMessIssueStatus = async (issueId, status, note) => {
  const response = await api.patch(`/api/mess/issues/${issueId}/status`, {
    status,
    note: note?.trim() || undefined,
  });
  return response.data?.issue;
};

export const getMessIssueEvidenceBlob = async (issueId) => {
  const response = await api.get(`/api/mess/issues/${issueId}/evidence`, {
    responseType: "blob",
  });
  return response.data;
};
