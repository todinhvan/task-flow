import { PanelLeftIcon, SearchIcon } from "lucide-react";
import { useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/context/AuthContext";
import { useEmployeeBoard } from "@/context/EmployeeBoardContext";
import { useI18n } from "@/context/I18nContext";
import LanguageSwitcher from "./LanguageSwitcher";
import NotificationBell from "./NotificationBell";
import ThemeToggle from "./ThemeToggle";
import UserAccountMenu from "./UserAccountMenu";

export default function EmployeeTopBar() {
  const { user } = useAuth();
  const location = useLocation();
  const { assignedPanelOpen, searchQuery, setSearchQuery, toggleAssignedPanel } =
    useEmployeeBoard();
  const { t } = useI18n();
  const isBoardRoute = location.pathname.startsWith("/board");

  if (!user) {
    return null;
  }

  return (
    <header className="sticky top-0 z-40 border-b border-outline-variant/80 bg-surface-container-lowest/95 px-4 py-3 text-on-surface shadow-[0_16px_32px_color-mix(in_oklch,var(--background),transparent_72%)] backdrop-blur xl:px-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        {isBoardRoute ? (
          <div className="flex flex-1 items-center gap-3 lg:max-w-3xl">
            <Button
              type="button"
              variant="outline"
              size="lg"
              aria-label={
                assignedPanelOpen
                  ? t("board.hideAssignedPanel")
                  : t("board.showAssignedPanel")
              }
              className="hidden h-11 w-11 shrink-0 rounded-2xl border-outline-variant bg-surface p-0 text-on-surface hover:bg-surface-container md:inline-flex"
              onClick={toggleAssignedPanel}
            >
              <PanelLeftIcon className="size-4" />
            </Button>

            <div className="relative flex-1">
              <SearchIcon className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-on-surface-variant" />
              <Input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder={t("board.searchPlaceholder")}
                className="h-11 rounded-2xl border-outline-variant bg-surface pl-11 text-on-surface placeholder:text-on-surface-variant focus-visible:border-ring focus-visible:ring-ring/20"
              />
            </div>
          </div>
        ) : null}

        <div className="ml-auto flex items-center gap-2 lg:pl-4">
          {user.role.code === "EMPLOYEE" ? <NotificationBell /> : null}
          <LanguageSwitcher />
          <ThemeToggle />
          <UserAccountMenu />
        </div>
      </div>
    </header>
  );
}
