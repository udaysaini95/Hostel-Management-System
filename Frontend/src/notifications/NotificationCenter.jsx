import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Bell, CheckCheck, Inbox } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { getApiErrorMessage } from "../api/errors.js";
import { Button, ErrorState, LoadingState } from "../components/ui/index.js";
import { useToast } from "../feedback/toastContext.js";
import {
  getNotificationUnreadCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "./notificationApi.js";
import { formatNotificationTime, groupNotifications } from "./notificationView.js";

const isSafeAppPath = (path) =>
  typeof path === "string" && path.startsWith("/") && !path.startsWith("//");

const NotificationGroup = ({ title, notifications, onOpen }) => {
  if (notifications.length === 0) return null;

  return (
    <section className="hm-notification-group" aria-labelledby={`notification-${title}`}>
      <h3 id={`notification-${title}`}>{title}</h3>
      <div className="hm-notification-list">
        {notifications.map((notification) => (
          <button
            key={notification.id}
            type="button"
            className={`hm-notification-item${notification.isRead ? "" : " hm-notification-item--unread"}`}
            onClick={() => onOpen(notification)}
          >
            <span className="hm-notification-item__heading">
              <strong>{notification.title}</strong>
              {!notification.isRead && <span>Unread</span>}
            </span>
            <span className="hm-notification-item__message">{notification.message}</span>
            <time dateTime={notification.createdAt}>
              {formatNotificationTime(notification.createdAt)}
            </time>
          </button>
        ))}
      </div>
    </section>
  );
};

export const NotificationCenter = () => {
  const panelId = useId();
  const navigate = useNavigate();
  const containerRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [markingAll, setMarkingAll] = useState(false);
  const { showToast } = useToast();

  const loadUnreadCount = useCallback(async () => {
    try {
      setUnreadCount(await getNotificationUnreadCount());
    } catch {
      // The full error is shown if the user opens the notification center.
    }
  }, []);

  const loadNotifications = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const result = await listNotifications();
      setNotifications(Array.isArray(result?.data) ? result.data : []);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, "Notifications could not be loaded."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUnreadCount();
    window.addEventListener("focus", loadUnreadCount);
    return () => window.removeEventListener("focus", loadUnreadCount);
  }, [loadUnreadCount]);

  useEffect(() => {
    if (open) loadNotifications();
  }, [loadNotifications, open]);

  useEffect(() => {
    if (!open) return undefined;

    const closeOnOutsideClick = (event) => {
      if (!containerRef.current?.contains(event.target)) setOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const openNotification = async (notification) => {
    if (!notification.isRead) {
      try {
        await markNotificationRead(notification.id);
        setNotifications((current) => current.map((item) =>
          item.id === notification.id ? { ...item, isRead: true } : item
        ));
        setUnreadCount((count) => Math.max(0, count - 1));
      } catch (requestError) {
        showToast({
          tone: "danger",
          title: "Notification was not updated",
          message: getApiErrorMessage(requestError, "Try again in a moment."),
        });
        return;
      }
    }

    setOpen(false);
    if (isSafeAppPath(notification.linkPath)) navigate(notification.linkPath);
  };

  const readAll = async () => {
    try {
      setMarkingAll(true);
      await markAllNotificationsRead();
      setNotifications((current) => current.map((item) => ({ ...item, isRead: true })));
      setUnreadCount(0);
    } catch (requestError) {
      showToast({
        tone: "danger",
        title: "Notifications were not updated",
        message: getApiErrorMessage(requestError, "Try again in a moment."),
      });
    } finally {
      setMarkingAll(false);
    }
  };

  const groups = groupNotifications(notifications);
  const countLabel = unreadCount > 99 ? "99+" : String(unreadCount);

  return (
    <div className="hm-notification-center" ref={containerRef}>
      <Button
        variant="quiet"
        size="icon"
        className="hm-notification-center__trigger"
        aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
        aria-expanded={open}
        aria-controls={panelId}
        title="Notifications"
        onClick={() => setOpen((current) => !current)}
      >
        <Bell aria-hidden="true" />
        {unreadCount > 0 && (
          <span className="hm-notification-center__count" aria-hidden="true">{countLabel}</span>
        )}
      </Button>

      {open && (
        <section id={panelId} className="hm-notification-panel" aria-label="Notification center">
          <header className="hm-notification-panel__header">
            <div>
              <h2>Notifications</h2>
              <p>{unreadCount > 0 ? `${unreadCount} unread` : "You’re all caught up"}</p>
            </div>
            {unreadCount > 0 && (
              <Button
                variant="quiet"
                loading={markingAll}
                loadingLabel="Marking all"
                leadingIcon={<CheckCheck aria-hidden="true" />}
                onClick={readAll}
              >
                Mark all read
              </Button>
            )}
          </header>

          <div className="hm-notification-panel__body">
            {loading ? (
              <LoadingState label="Loading notifications" rows={4} compact />
            ) : error ? (
              <ErrorState title="Notifications are unavailable" description={error} onRetry={loadNotifications} />
            ) : notifications.length === 0 ? (
              <div className="hm-notification-panel__empty" role="status">
                <Inbox aria-hidden="true" />
                <strong>No notifications yet</strong>
                <span>Workflow updates will appear here.</span>
              </div>
            ) : (
              <>
                <NotificationGroup title="Recent" notifications={groups.recent} onOpen={openNotification} />
                <NotificationGroup title="Earlier" notifications={groups.earlier} onOpen={openNotification} />
              </>
            )}
          </div>
        </section>
      )}
    </div>
  );
};
