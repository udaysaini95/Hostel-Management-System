import api from "../api/axios.js";

export const getComplaintCategories = async () => {
  const response = await api.get("/api/complaints/categories");
  const categories = response.data?.data;

  if (!Array.isArray(categories)) {
    throw new Error("Complaint category response was invalid");
  }

  return categories;
};

export const getMyComplaints = async ({ page = 1, status } = {}) => {
  const response = await api.get("/api/complaints/mine", {
    params: {
      page,
      pageSize: 10,
      sortBy: "updatedAt",
      sortOrder: "desc",
      ...(status ? { status } : {}),
    },
  });

  const result = response.data;
  if (!Array.isArray(result?.data) || !result?.pagination) {
    throw new Error("Complaint list response was invalid");
  }

  return result;
};

export const getComplaint = async (complaintId) => {
  const [complaintResponse, attachmentResponse] = await Promise.all([
    api.get(`/api/complaints/${complaintId}`),
    api.get(`/api/complaints/${complaintId}/attachments`),
  ]);

  return {
    complaint: complaintResponse.data?.complaint,
    attachments: attachmentResponse.data?.data ?? [],
  };
};

export const createComplaint = async (values) => {
  const response = await api.post("/api/complaints", values);
  return response.data?.complaint;
};

export const addComplaintAttachment = async (complaintId, file) => {
  const body = new FormData();
  body.append("file", file);
  const response = await api.post(
    `/api/complaints/${complaintId}/attachments`,
    body,
    { headers: { "Content-Type": "multipart/form-data" } }
  );
  return response.data?.attachment;
};

export const removeComplaintAttachment = async (complaintId, attachmentId) =>
  api.delete(`/api/complaints/${complaintId}/attachments/${attachmentId}`);

export const getComplaintAttachmentBlob = async (
  complaintId,
  attachmentId
) => {
  const response = await api.get(
    `/api/complaints/${complaintId}/attachments/${attachmentId}`,
    { responseType: "blob" }
  );
  return response.data;
};

export const verifyComplaint = async (complaintId, values) => {
  const response = await api.post(
    `/api/complaints/${complaintId}/verification`,
    values
  );
  return response.data?.complaint;
};
