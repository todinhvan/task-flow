import { XIcon } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { useI18n } from "@/context/I18nContext";
import type { RoleCode } from "@/types/api";
import { PermissionCode, hasPermission } from "@/lib/permissions";

function buildNavItems(
  roleCode: RoleCode,
  pathname: string,
  userPermissions: {
    dashboard: boolean;
    users: boolean;
    tasks: boolean;
    roles: boolean;
    permissions: boolean;
  },
  labels: {
    dashboard: string;
    users: string;
    tasks: string;
    roles: string;
    permissions: string;
  },
) {
  const isManageWorkspace =
    pathname.startsWith("/manage") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/manager") ||
    roleCode === "ADMIN" ||
    roleCode === "MANAGER";

  if (!isManageWorkspace) {
    return [];
  }

  return [
    userPermissions.dashboard
      ? { to: "/manage/dashboard", icon: "space_dashboard", label: labels.dashboard }
      : null,
    userPermissions.users
      ? { to: "/manage/users", icon: "group", label: labels.users }
      : null,
    userPermissions.tasks
      ? { to: "/manage/tasks", icon: "task", label: labels.tasks }
      : null,
    userPermissions.roles
      ? { to: "/manage/roles", icon: "security", label: labels.roles }
      : null,
    userPermissions.permissions
      ? { to: "/manage/permissions", icon: "verified_user", label: labels.permissions }
      : null,
  ].filter(Boolean) as Array<{ to: string; icon: string; label: string }>;
}

function NavItem({
  to,
  icon,
  label,
}: {
  to: string;
  icon: string;
  label: string;
}) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        [
          "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition",
          isActive
            ? "bg-primary text-on-primary shadow-sm"
            : "text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface",
        ].join(" ")
      }
    >
      <span className="material-symbols-outlined text-[20px]">{icon}</span>
      {label}
    </NavLink>
  );
}

export default function AdminSidebar() {
  const { user } = useAuth();
  const { t } = useI18n();
  const location = useLocation();

  if (!user) {
    return null;
  }

  const navItems = buildNavItems(user.role.code, location.pathname, {
    dashboard: hasPermission(user, PermissionCode.DashboardRead),
    users: hasPermission(user, PermissionCode.UserManage),
    tasks: hasPermission(user, PermissionCode.TaskAssign),
    roles: hasPermission(user, PermissionCode.RoleManage),
    permissions: hasPermission(user, PermissionCode.PermissionManage),
  }, {
    dashboard: t("nav.dashboard"),
    users: t("nav.users"),
    tasks: t("nav.tasks"),
    roles: t("nav.roles"),
    permissions: t("nav.permissions"),
  });

  return (
    <aside className="hidden h-screen w-[272px] flex-col border-r border-outline-variant/80 bg-surface-container-lowest px-5 py-6 lg:fixed lg:inset-y-0 lg:left-0 lg:flex">
      <div className="mb-8 flex items-center gap-3 px-2">
        <div className="flex size-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <span
            className="material-symbols-outlined text-[20px]"
            style={{ fontVariationSettings: '"FILL" 1' }}
          >
            task_alt
          </span>
        </div>
        <span className="text-xl font-semibold tracking-tight text-on-surface">
          TaskFlow
        </span>
      </div>

      <nav className="flex flex-1 flex-col gap-2">
        {navItems.map((item) => (
          <NavItem key={item.to} {...item} />
        ))}
      </nav>
    </aside>
  );
}

export function MobileAdminSidebar({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const { t } = useI18n();
  const location = useLocation();

  if (!user) {
    return null;
  }

  const navItems = buildNavItems(user.role.code, location.pathname, {
    dashboard: hasPermission(user, PermissionCode.DashboardRead),
    users: hasPermission(user, PermissionCode.UserManage),
    tasks: hasPermission(user, PermissionCode.TaskAssign),
    roles: hasPermission(user, PermissionCode.RoleManage),
    permissions: hasPermission(user, PermissionCode.PermissionManage),
  }, {
    dashboard: t("nav.dashboard"),
    users: t("nav.users"),
    tasks: t("nav.tasks"),
    roles: t("nav.roles"),
    permissions: t("nav.permissions"),
  });

  return (
    <div
      className={[
        "fixed inset-0 z-40 lg:hidden",
        open ? "pointer-events-auto" : "pointer-events-none",
      ].join(" ")}
      aria-hidden={!open}
    >
      <button
        type="button"
        className={[
          "absolute inset-0 bg-black/30 transition-opacity",
          open ? "opacity-100" : "opacity-0",
        ].join(" ")}
        onClick={onClose}
      />

      <aside
        className={[
          "relative flex h-full w-[min(85vw,20rem)] flex-col border-r border-outline-variant/80 bg-surface-container-lowest px-5 py-6 shadow-xl transition-transform",
          open ? "translate-x-0" : "-translate-x-full",
        ].join(" ")}
      >
        <div className="mb-8 flex items-center justify-between gap-3 px-2">
          <span className="text-xl font-semibold tracking-tight text-on-surface">
            TaskFlow
          </span>
          <Button type="button" variant="ghost" size="icon" onClick={onClose}>
            <XIcon className="size-5" />
            <span className="sr-only">{t("nav.closeNavigation")}</span>
          </Button>
        </div>

        <nav className="flex flex-1 flex-col gap-2">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onClose}
              className={({ isActive }) =>
                [
                  "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition",
                  isActive
                    ? "bg-primary text-on-primary shadow-sm"
                    : "text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface",
                ].join(" ")
              }
            >
              <span className="material-symbols-outlined text-[20px]">
                {item.icon}
              </span>
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>
    </div>
  );
}
