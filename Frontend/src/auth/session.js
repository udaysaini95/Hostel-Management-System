import { isSupportedRole } from "./roles.js";

export const AUTH_STATUS = Object.freeze({
  CHECKING: "checking",
  AUTHENTICATED: "authenticated",
  ANONYMOUS: "anonymous",
  UNAVAILABLE: "unavailable",
});

export const SESSION_ENDED_EVENT = "hostelmate:session-ended";

const storageKeys = Object.freeze({
  token: "token",
  role: "role",
  user: "user",
});

const getBrowserStorage = () => {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage;
};

export const readStoredToken = (storage = getBrowserStorage()) => {
  try {
    return storage?.getItem(storageKeys.token) || null;
  } catch {
    return null;
  }
};

export const normalizeSessionUser = (value) => {
  const id = Number(value?.id);
  const name = typeof value?.name === "string" ? value.name.trim() : "";
  const email = typeof value?.email === "string" ? value.email.trim() : "";

  if (
    !Number.isSafeInteger(id) ||
    id < 1 ||
    !name ||
    !email ||
    !isSupportedRole(value?.role)
  ) {
    return null;
  }

  return Object.freeze({ id, name, email, role: value.role });
};

export const storeSession = (
  { token, user },
  storage = getBrowserStorage()
) => {
  if (!storage || typeof token !== "string" || !token || !user) {
    return false;
  }

  try {
    storage.setItem(storageKeys.token, token);
    storage.setItem(storageKeys.role, user.role);
    storage.setItem(storageKeys.user, JSON.stringify(user));
    return true;
  } catch {
    return false;
  }
};

export const updateStoredUser = (user, storage = getBrowserStorage()) => {
  if (!storage || !user) {
    return false;
  }

  try {
    storage.setItem(storageKeys.role, user.role);
    storage.setItem(storageKeys.user, JSON.stringify(user));
    return true;
  } catch {
    return false;
  }
};

export const clearStoredSession = (storage = getBrowserStorage()) => {
  if (!storage) {
    return;
  }

  try {
    Object.values(storageKeys).forEach((key) => storage.removeItem(key));
  } catch {
    // The in-memory auth state is still cleared when browser storage is blocked.
  }
};

export const announceSessionEnded = (detail = {}) => {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new CustomEvent(SESSION_ENDED_EVENT, { detail }));
};

export const getSessionEndMessage = (errorCode) => {
  if (errorCode === "SESSION_EXPIRED") {
    return "Your session expired. Sign in again to continue.";
  }

  return "Your sign-in session is no longer valid. Please sign in again.";
};
