import api from "../api/axios.js";

export const getHostels = async ({ includeInactive = true } = {}) => {
  const response = await api.get("/api/admin/hostels", {
    params: { includeInactive },
  });
  return response.data;
};

export const createHostel = async (values) => {
  const response = await api.post("/api/admin/hostels", values);
  return response.data;
};

export const updateHostel = async (hostelId, values) => {
  const response = await api.patch(`/api/admin/hostels/${hostelId}`, values);
  return response.data;
};

export const changeHostelStatus = async (hostelId, isActive) => {
  const response = await api.patch(`/api/admin/hostels/${hostelId}/status`, {
    isActive,
  });
  return response.data;
};

export const getHostelInventory = async (hostelId) => {
  const response = await api.get(`/api/admin/hostels/${hostelId}/inventory`);
  return response.data;
};

export const createHostelBlock = async (hostelId, values) => {
  const response = await api.post(
    `/api/admin/hostels/${hostelId}/blocks`,
    values
  );
  return response.data;
};

export const updateHostelBlock = async (hostelId, blockId, values) => {
  const response = await api.patch(
    `/api/admin/hostels/${hostelId}/blocks/${blockId}`,
    values
  );
  return response.data;
};

export const changeHostelBlockStatus = async (
  hostelId,
  blockId,
  isActive
) => {
  const response = await api.patch(
    `/api/admin/hostels/${hostelId}/blocks/${blockId}/status`,
    { isActive }
  );
  return response.data;
};

export const createHostelRoom = async (hostelId, blockId, values) => {
  const response = await api.post(
    `/api/admin/hostels/${hostelId}/blocks/${blockId}/rooms`,
    values
  );
  return response.data;
};

export const updateHostelRoom = async (hostelId, roomId, values) => {
  const response = await api.patch(
    `/api/admin/hostels/${hostelId}/rooms/${roomId}`,
    values
  );
  return response.data;
};

export const changeHostelRoomStatus = async (hostelId, roomId, isActive) => {
  const response = await api.patch(
    `/api/admin/hostels/${hostelId}/rooms/${roomId}/status`,
    { isActive }
  );
  return response.data;
};
