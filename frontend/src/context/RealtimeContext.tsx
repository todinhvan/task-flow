import {
  createContext,
  startTransition,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/context/AuthContext";
import { API_BASE_URL } from "@/lib/api";
import type {
  RealtimeNotification,
  RealtimeServerEvent,
  RealtimeTaskEvent,
} from "@/types/api";

type ConnectionState = "connecting" | "connected" | "disconnected";

type RealtimeContextValue = {
  activeToasts: RealtimeNotification[];
  connectionState: ConnectionState;
  lastEvent: RealtimeTaskEvent | null;
  notifications: RealtimeNotification[];
  unreadCount: number;
  dismissToast: (notificationId: string) => void;
  markAllAsRead: () => void;
  markAsRead: (notificationId: string) => void;
};

const RealtimeContext = createContext<RealtimeContextValue | undefined>(
  undefined,
);

const MAX_NOTIFICATIONS = 20;
const MAX_TOASTS = 3;
const TOAST_TTL_MS = 6000;

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const { accessToken, user } = useAuth();
  const [notifications, setNotifications] = useState<RealtimeNotification[]>([]);
  const [toastIds, setToastIds] = useState<string[]>([]);
  const [lastEvent, setLastEvent] = useState<RealtimeTaskEvent | null>(null);
  const [connectionState, setConnectionState] =
    useState<ConnectionState>("disconnected");
  const toastTimeoutsRef = useRef(new Map<string, number>());

  useEffect(() => {
    return () => {
      for (const timeoutId of toastTimeoutsRef.current.values()) {
        window.clearTimeout(timeoutId);
      }
      toastTimeoutsRef.current.clear();
    };
  }, []);

  useEffect(() => {
    if (!accessToken || !user) {
      for (const timeoutId of toastTimeoutsRef.current.values()) {
        window.clearTimeout(timeoutId);
      }
      toastTimeoutsRef.current.clear();
      setConnectionState("disconnected");
      setNotifications([]);
      setToastIds([]);
      setLastEvent(null);
      return;
    }

    setConnectionState("connecting");

    const source = new EventSource(
      `${API_BASE_URL}/realtime/stream?token=${encodeURIComponent(accessToken)}`,
    );

    const handleTaskEvent = (message: MessageEvent) => {
      const event = parseRealtimeEvent(message.data);
      if (!event || event.type === "connected") {
        return;
      }

      startTransition(() => {
        setLastEvent(event);
        if (event.type !== "task.assigned") {
          return;
        }

        const notification: RealtimeNotification = {
          id: event.id,
          createdAt: event.occurredAt,
          isRead: false,
          event,
        };

        setNotifications((current) => [notification, ...current].slice(0, MAX_NOTIFICATIONS));
        setToastIds((current) => [notification.id, ...current.filter((id) => id !== notification.id)].slice(0, MAX_TOASTS));

        const existingTimeout = toastTimeoutsRef.current.get(notification.id);
        if (existingTimeout) {
          window.clearTimeout(existingTimeout);
        }

        const timeoutId = window.setTimeout(() => {
          setToastIds((current) => current.filter((id) => id !== notification.id));
          toastTimeoutsRef.current.delete(notification.id);
        }, TOAST_TTL_MS);

        toastTimeoutsRef.current.set(notification.id, timeoutId);
      });
    };

    const handleConnectedEvent = (message: MessageEvent) => {
      const event = parseRealtimeEvent(message.data);
      if (!event || event.type !== "connected") {
        return;
      }

      setConnectionState("connected");
    };

    const eventTypes = ["task.assigned", "task.updated", "task.deleted"] as const;
    for (const eventType of eventTypes) {
      source.addEventListener(eventType, handleTaskEvent as EventListener);
    }
    source.addEventListener("connected", handleConnectedEvent as EventListener);
    source.onopen = () => {
      setConnectionState("connected");
    };
    source.onerror = () => {
      setConnectionState("disconnected");
    };

    return () => {
      source.close();
      for (const eventType of eventTypes) {
        source.removeEventListener(eventType, handleTaskEvent as EventListener);
      }
      source.removeEventListener("connected", handleConnectedEvent as EventListener);
      setConnectionState("disconnected");
    };
  }, [accessToken, user?.id]);

  const value = useMemo<RealtimeContextValue>(
    () => ({
      activeToasts: toastIds
        .map((id) => notifications.find((notification) => notification.id === id))
        .filter((notification): notification is RealtimeNotification => Boolean(notification)),
      connectionState,
      lastEvent,
      notifications,
      unreadCount: notifications.filter((notification) => !notification.isRead)
        .length,
      dismissToast: (notificationId) => {
        const timeoutId = toastTimeoutsRef.current.get(notificationId);
        if (timeoutId) {
          window.clearTimeout(timeoutId);
          toastTimeoutsRef.current.delete(notificationId);
        }

        setToastIds((current) => current.filter((id) => id !== notificationId));
      },
      markAllAsRead: () => {
        setNotifications((current) =>
          current.map((notification) => ({ ...notification, isRead: true })),
        );
      },
      markAsRead: (notificationId) => {
        setNotifications((current) =>
          current.map((notification) =>
            notification.id === notificationId
              ? { ...notification, isRead: true }
              : notification,
          ),
        );
      },
    }),
    [connectionState, lastEvent, notifications, toastIds],
  );

  return (
    <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>
  );
}

export function useRealtime() {
  const context = useContext(RealtimeContext);
  if (!context) {
    throw new Error("useRealtime must be used within RealtimeProvider");
  }

  return context;
}

function parseRealtimeEvent(payload: string): RealtimeServerEvent | null {
  try {
    const parsed = JSON.parse(payload) as RealtimeServerEvent;
    if (!parsed || typeof parsed !== "object" || typeof parsed.type !== "string") {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}
