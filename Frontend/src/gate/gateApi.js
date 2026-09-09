import api from "../api/axios.js";

export const verifyGatePass = async (credential) => {
  const response = await api.post("/api/gate/passes/verify", { credential });
  return response.data?.verification;
};

export const recordGateMovement = async (payload) => {
  const response = await api.post("/api/gate/passes/movements", payload);
  return response.data?.movement;
};

export const listOutsideRoster = async (filters = {}) => {
  const response = await api.get("/api/gate/outside", { params: filters });
  return response.data;
};

export const listGateMovements = async (filters = {}) => {
  const response = await api.get("/api/gate/movements", { params: filters });
  return response.data;
};
