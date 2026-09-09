import api from "../api/axios.js";

export const listLeaveReviewQueue = async (filters = {}) => {
  const response = await api.get("/api/leave/review", { params: filters });
  return response.data;
};

export const decideLeaveRequest = async (leaveRequestId, decision) => {
  const response = await api.post(
    `/api/leave/${leaveRequestId}/decision`,
    decision
  );
  return response.data;
};
