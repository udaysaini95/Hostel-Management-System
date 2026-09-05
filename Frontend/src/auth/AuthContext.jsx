import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import api from "../api/axios.js";
import { AuthContext } from "./authContext.js";
import {
  AUTH_STATUS,
  clearStoredSession,
  getSessionEndMessage,
  normalizeSessionUser,
  readStoredToken,
  SESSION_ENDED_EVENT,
  storeSession,
  updateStoredUser,
} from "./session.js";

const createInitialState = () => ({
  status: readStoredToken() ? AUTH_STATUS.CHECKING : AUTH_STATUS.ANONYMOUS,
  user: null,
  message: null,
});

const isCanceledRequest = (error) => error?.code === "ERR_CANCELED";

export const AuthProvider = ({ children }) => {
  const [authState, setAuthState] = useState(createInitialState);

  const signOut = useCallback((message = null) => {
    clearStoredSession();
    setAuthState({
      status: AUTH_STATUS.ANONYMOUS,
      user: null,
      message,
    });
  }, []);

  const loadStoredSession = useCallback(async ({ signal } = {}) => {
    const token = readStoredToken();

    if (!token) {
      return;
    }

    try {
      const response = await api.get("/api/auth/me", { signal });
      const user = normalizeSessionUser(response.data);

      if (!user) {
        signOut("HostelMate could not verify your account. Please sign in again.");
        return;
      }

      updateStoredUser(user);
      setAuthState({
        status: AUTH_STATUS.AUTHENTICATED,
        user,
        message: null,
      });
    } catch (error) {
      if (isCanceledRequest(error)) {
        return;
      }

      if (error.response?.status === 401) {
        signOut(getSessionEndMessage(error.response?.data?.code));
        return;
      }

      setAuthState((currentState) => ({
        ...currentState,
        status: AUTH_STATUS.UNAVAILABLE,
        message:
          "HostelMate could not verify your session. Check the server connection and try again.",
      }));
    }
  }, [signOut]);

  useEffect(() => {
    if (!readStoredToken()) {
      return undefined;
    }

    const controller = new AbortController();
    Promise.resolve().then(() =>
      loadStoredSession({ signal: controller.signal })
    );

    return () => controller.abort();
  }, [loadStoredSession]);

  useEffect(() => {
    const handleSessionEnded = (event) => {
      signOut(
        event.detail?.message ||
          "Your sign-in session ended. Please sign in again."
      );
    };

    window.addEventListener(SESSION_ENDED_EVENT, handleSessionEnded);
    return () =>
      window.removeEventListener(SESSION_ENDED_EVENT, handleSessionEnded);
  }, [signOut]);

  const signIn = useCallback((sessionResponse) => {
    const token = sessionResponse?.token;
    const user = normalizeSessionUser(sessionResponse?.user);

    if (!token || !user) {
      throw new Error("The server returned an invalid sign-in session.");
    }

    if (!storeSession({ token, user })) {
      throw new Error("The browser could not save the sign-in session.");
    }

    setAuthState({
      status: AUTH_STATUS.AUTHENTICATED,
      user,
      message: null,
    });

    return user;
  }, []);

  const retrySessionCheck = useCallback(() => {
    if (!readStoredToken()) {
      signOut();
      return;
    }

    setAuthState((currentState) => ({
      ...currentState,
      status: AUTH_STATUS.CHECKING,
    }));
    loadStoredSession();
  }, [loadStoredSession, signOut]);

  const contextValue = useMemo(
    () => ({
      ...authState,
      signIn,
      signOut,
      retrySessionCheck,
    }),
    [authState, retrySessionCheck, signIn, signOut]
  );

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};
