import axios from "axios";
import { frontendServiceConfig } from "../config/serviceUrls";
import {
  announceSessionEnded,
  clearStoredSession,
  getSessionEndMessage,
  readStoredToken,
} from "../auth/session.js";

const api = axios.create({
  baseURL: frontendServiceConfig.apiBaseUrl,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use(
  (config) => {
    const token = readStoredToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const requestUsedSession = Boolean(error.config?.headers?.Authorization);

    if (error.response?.status === 401 && requestUsedSession) {
      const errorCode = error.response?.data?.code;
      const message = getSessionEndMessage(errorCode);

      clearStoredSession();
      announceSessionEnded({ code: errorCode, message });
    }

    return Promise.reject(error);
  }
);

export default api;
