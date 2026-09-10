import api from "../api/axios.js";

export const listMyNotices = async ({ page = 1, ...filters } = {}) => {
  const response = await api.get("/api/notices/mine", {
    params: { page, pageSize: 10, ...filters },
  });
  return response.data;
};

export const listManagedNotices = async ({ page = 1, ...filters } = {}) => {
  const response = await api.get("/api/notices/managed", {
    params: { page, pageSize: 10, ...filters },
  });
  return response.data;
};

export const publishNotice = async (notice) => {
  const response = await api.post("/api/notices", notice);
  return response.data;
};

export const markNoticeRead = async (noticeId) => {
  const response = await api.patch(`/api/notices/${noticeId}/read`);
  return response.data;
};

const addLocation = (map, room) => {
  const hostel = room?.hostel;
  const block = room?.block;
  if (!hostel?.id || !block?.id) return;

  if (!map.has(hostel.id)) {
    map.set(hostel.id, { ...hostel, blocks: new Map() });
  }
  map.get(hostel.id).blocks.set(block.id, block);
};

export const getNoticeAudienceLocations = async () => {
  const locations = new Map();
  let page = 1;
  let totalPages = 1;

  do {
    const response = await api.get("/api/rooms", {
      params: { page, pageSize: 100, availability: "all" },
    });
    const rooms = Array.isArray(response.data?.data) ? response.data.data : [];
    rooms.forEach((room) => addLocation(locations, room));
    totalPages = Math.max(1, Number(response.data?.pagination?.totalPages) || 1);
    page += 1;
  } while (page <= totalPages);

  return [...locations.values()].map(({ blocks, ...hostel }) => ({
    ...hostel,
    blocks: [...blocks.values()],
  }));
};
