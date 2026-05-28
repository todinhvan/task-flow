import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useI18n } from "@/context/I18nContext";
import type { RoleCode } from "@/types/api";
import {
  getManageHomePath,
  type PermissionCodeValue,
  hasAnyPermission,
} from "@/lib/permissions";

type ProtectedRouteProps = {
  roles?: RoleCode[];
  permissions?: PermissionCodeValue[];
};

function getHomePath(roleCode: RoleCode) {
  switch (roleCode) {
    case "ADMIN":
      return "/manage/dashboard";
    case "MANAGER":
      return "/manage/tasks";
    case "EMPLOYEE":
      return "/board";
    default:
      return "/login";
  }
}

export default function ProtectedRoute({
  roles,
  permissions,
}: ProtectedRouteProps) {
  const { user, isLoading } = useAuth();
  const { t } = useI18n();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-on-surface">
        {t("common.loadingWorkspace")}
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (roles && !roles.includes(user.role.code)) {
    return <Navigate to={getHomePath(user.role.code)} replace />;
  }

  if (permissions && !hasAnyPermission(user, permissions)) {
    return <Navigate to={getManageHomePath(user)} replace />;
  }

  return <Outlet />;
}

export { getHomePath };
