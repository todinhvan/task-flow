import { BellIcon, XIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/context/I18nContext";
import { useRealtime } from "@/context/RealtimeContext";
import type { RealtimeNotification } from "@/types/api";

export default function NotificationToasts() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const { activeToasts, dismissToast, markAsRead } = useRealtime();

  if (activeToasts.length === 0) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed right-4 top-20 z-50 flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-3">
      {activeToasts.map((notification) => (
        <div
          key={notification.id}
          className="pointer-events-auto rounded-[28px] border border-outline-variant bg-surface-container-lowest p-4 shadow-xl ring-1 ring-foreground/5 backdrop-blur"
        >
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-2xl bg-primary/12 p-2 text-primary">
              <BellIcon className="size-4" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-on-surface">
                {t("notifications.assignedTitle")}
              </div>
              <p className="mt-1 text-sm text-on-surface-variant">
                {getToastBody(notification, t)}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    markAsRead(notification.id);
                    dismissToast(notification.id);
                    navigate("/board");
                  }}
                >
                  {t("notifications.openBoard")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => dismissToast(notification.id)}
                >
                  {t("common.close")}
                </Button>
              </div>
            </div>

            <button
              type="button"
              className="rounded-full p-1 text-on-surface-variant transition hover:bg-surface-container hover:text-on-surface"
              onClick={() => dismissToast(notification.id)}
            >
              <XIcon className="size-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function getToastBody(
  notification: RealtimeNotification,
  t: (key: string, params?: Record<string, string | number>) => string,
) {
  return t("notifications.assignedBody", {
    actor: notification.event.actor.fullName,
    task: notification.event.task.title,
  });
}
