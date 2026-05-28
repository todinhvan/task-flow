import { LogOutIcon, MonitorCogIcon, UserIcon } from "lucide-react";
import { useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenuGroup,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/context/AuthContext";
import { useI18n } from "@/context/I18nContext";
import { PermissionCode, hasPermission } from "@/lib/permissions";

function initials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function resolveProfilePath(pathname: string, roleCode: string) {
  if (pathname.startsWith("/manager")) {
    return "/manage/profile";
  }

  if (pathname.startsWith("/board") || pathname.startsWith("/profile")) {
    return "/profile";
  }

  if (roleCode === "MANAGER") {
    return "/manage/profile";
  }

  if (roleCode === "EMPLOYEE") {
    return "/profile";
  }

  return "/manage/profile";
}

export default function UserAccountMenu() {
  const { logout, user } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();

  const profilePath = useMemo(() => {
    if (!user) {
      return "/login";
    }

    return resolveProfilePath(location.pathname, user.role.code);
  }, [location.pathname, user]);

  if (!user) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-lg"
            className="rounded-full border border-outline-variant/70 bg-surface-container-lowest"
          />
        }
      >
        <Avatar className="size-9">
          <AvatarImage
            src={user.profile.avatarUrl ?? undefined}
            alt={user.profile.fullName}
          />
          <AvatarFallback>{initials(user.profile.fullName)}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuGroup>
          <DropdownMenuLabel>
            <div className="min-w-0">
              <div className="truncate font-medium text-foreground">
                {user.profile.fullName}
              </div>
              <div className="truncate text-xs text-muted-foreground">
                {user.email}
              </div>
            </div>
          </DropdownMenuLabel>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={() => navigate(profilePath)}>
          <UserIcon className="size-4" />
          {t("account.viewEditProfile")}
        </DropdownMenuItem>

        {user.role.code === "ADMIN" ? (
          <DropdownMenuItem onClick={() => navigate("/manage/dashboard")}>
            <MonitorCogIcon className="size-4" />
            {t("account.managerPage")}
          </DropdownMenuItem>
        ) : null}

        {user.role.code === "MANAGER" && hasPermission(user, PermissionCode.TaskAssign) ? (
          <DropdownMenuItem onClick={() => navigate("/manage/tasks")}>
            <MonitorCogIcon className="size-4" />
            {t("account.manageWorkspace")}
          </DropdownMenuItem>
        ) : null}

        <DropdownMenuSeparator />

        <DropdownMenuItem
          variant="destructive"
          onClick={() => {
            void logout();
          }}
        >
          <LogOutIcon className="size-4" />
          {t("account.logout")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
