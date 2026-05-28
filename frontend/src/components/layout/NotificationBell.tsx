import { BellIcon, CircleIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useI18n } from "@/context/I18nContext";
import { useRealtime } from "@/context/RealtimeContext";
import type { RealtimeNotification } from "@/types/api";

export default function NotificationBell() {
  const navigate = useNavigate();
  const { locale, t } = useI18n();
  const { connectionState, markAllAsRead, markAsRead, notifications, unreadCount } =
    useRealtime();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="relative"
          />
        }
      >
        <BellIcon className="size-4" />
        {unreadCount > 0 ? (
          <span className="absolute -right-1 -top-1 inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
        <span className="sr-only">{t("notifications.open")}</span>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        className="w-[min(24rem,calc(100vw-2rem))] min-w-80 max-w-[calc(100vw-2rem)] rounded-3xl p-0"
      >
        <DropdownMenuGroup>
          <div className="flex items-start justify-between gap-4 px-4 py-4">
            <div>
              <div className="text-sm font-semibold text-popover-foreground">
                {t("notifications.title")}
              </div>
              <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                <CircleIcon
                  className={[
                    "size-2 fill-current stroke-none",
                    connectionState === "connected"
                      ? "text-emerald-500"
                      : "text-muted-foreground/70",
                  ].join(" ")}
                />
                {connectionState === "connected"
                  ? t("notifications.live")
                  : t("notifications.offline")}
              </div>
            </div>

            {unreadCount > 0 ? (
              <button
                type="button"
                className="text-xs font-medium text-primary transition hover:text-primary/80"
                onClick={markAllAsRead}
              >
                {t("notifications.markAllRead")}
              </button>
            ) : null}
          </div>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        {notifications.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            {t("notifications.empty")}
          </div>
        ) : (
          <div className="max-h-[24rem] overflow-y-auto px-2 py-2">
            {notifications.map((notification) => (
              <button
                key={notification.id}
                type="button"
                className={[
                  "flex w-full flex-col items-start gap-2 rounded-2xl px-3 py-3 text-left transition",
                  notification.isRead ? "bg-transparent" : "bg-primary/8",
                  "hover:bg-accent",
                ].join(" ")}
                onClick={() => {
                  markAsRead(notification.id);
                  navigate("/board");
                }}
              >
                <div className="flex w-full items-start justify-between gap-3">
                  <div className="text-sm font-medium text-popover-foreground">
                    {getNotificationTitle(notification, t)}
                  </div>
                  {!notification.isRead ? (
                    <span className="mt-1 size-2 shrink-0 rounded-full bg-primary" />
                  ) : null}
                </div>
                <p className="text-sm text-muted-foreground">
                  {getNotificationBody(notification, t)}
                </p>
                <span className="text-xs text-muted-foreground">
                  {new Intl.DateTimeFormat(locale, {
                    day: "2-digit",
                    month: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  }).format(new Date(notification.createdAt))}
                </span>
              </button>
            ))}
          </div>
        )}

        {notifications.length > 0 ? (
          <>
            <DropdownMenuSeparator />
            <div className="px-4 py-3 text-xs text-muted-foreground">
              {t("notifications.openBoard")}
            </div>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function getNotificationTitle(
  notification: RealtimeNotification,
  t: (key: string, params?: Record<string, string | number>) => string,
) {
  if (notification.event.type === "task.deleted") {
    return t("notifications.deletedTitle");
  }

  if (notification.event.type === "task.updated") {
    return t("notifications.updatedTitle");
  }

  return t("notifications.assignedTitle");
}

function getNotificationBody(
  notification: RealtimeNotification,
  t: (key: string, params?: Record<string, string | number>) => string,
) {
  if (notification.event.type === "task.deleted") {
    return t("notifications.deletedBody", {
      actor: notification.event.actor.fullName,
      task: notification.event.task.title,
    });
  }

  if (notification.event.type === "task.updated") {
    return t("notifications.updatedBody", {
      actor: notification.event.actor.fullName,
      task: notification.event.task.title,
    });
  }

  return t("notifications.assignedBody", {
    actor: notification.event.actor.fullName,
    task: notification.event.task.title,
  });
}
