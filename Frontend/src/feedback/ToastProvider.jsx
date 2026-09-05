import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Toast } from "../components/ui/Feedback.jsx";
import { ToastContext } from "./toastContext.js";

const DEFAULT_DURATION = 5000;
const MAX_VISIBLE_TOASTS = 4;

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const nextToastId = useRef(0);
  const timers = useRef(new Map());

  const dismissToast = useCallback((toastId) => {
    const timer = timers.current.get(toastId);

    if (timer) {
      window.clearTimeout(timer);
      timers.current.delete(toastId);
    }

    setToasts((currentToasts) =>
      currentToasts.filter((toast) => toast.id !== toastId)
    );
  }, []);

  const showToast = useCallback(
    ({ tone = "info", title, message, duration = DEFAULT_DURATION }) => {
      nextToastId.current += 1;
      const id = nextToastId.current;
      const toast = { id, tone, title, message };

      setToasts((currentToasts) =>
        [...currentToasts, toast].slice(-MAX_VISIBLE_TOASTS)
      );

      if (duration > 0) {
        const timer = window.setTimeout(() => dismissToast(id), duration);
        timers.current.set(id, timer);
      }

      return id;
    },
    [dismissToast]
  );

  useEffect(
    () => () => {
      timers.current.forEach((timer) => window.clearTimeout(timer));
      timers.current.clear();
    },
    []
  );

  const contextValue = useMemo(
    () => ({ showToast, dismissToast }),
    [dismissToast, showToast]
  );

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      {createPortal(
        <div className="hm-toast-region" aria-label="Notifications">
          {toasts.map((toast) => (
            <Toast
              key={toast.id}
              tone={toast.tone}
              title={toast.title}
              message={toast.message}
              onDismiss={() => dismissToast(toast.id)}
            />
          ))}
        </div>,
        document.body
      )}
    </ToastContext.Provider>
  );
};
