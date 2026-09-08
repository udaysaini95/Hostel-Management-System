import api from "../api/axios.js";

export const listMyLeaveRequests = async (filters = {}) => {
  const response = await api.get("/api/leave", { params: filters });
  return response.data;
};

export const createLeaveRequest = async (payload) => {
  const response = await api.post("/api/leave", payload);
  return response.data?.leaveRequest;
};

export const loadGatePassImage = async (leaveRequestId) => {
  const response = await api.get(`/api/leave/${leaveRequestId}/pass/qr`, {
    responseType: "blob",
  });
  return URL.createObjectURL(response.data);
};

export const downloadGatePassPdf = async (leaveRequestId) => {
  const response = await api.get(`/api/leave/${leaveRequestId}/pass/pdf`, {
    responseType: "blob",
  });
  const objectUrl = URL.createObjectURL(response.data);
  const link = document.createElement("a");

  link.href = objectUrl;
  link.download = `hostelmate-gate-pass-${leaveRequestId}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
};
