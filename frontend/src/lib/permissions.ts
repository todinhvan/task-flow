import type { SessionUser } from "@/types/api";

export const PermissionCode = {
  DashboardRead: "dashboard:read",
  UserManage: "user:manage",
  RoleManage: "role:manage",
  PermissionManage: "permission:manage",
  TaskAssign: "task:assign",
  TaskMove: "task:move",
  TaskStatus: "task:status",
  ListManage: "list:manage",
  ProfileManage: "profile:manage",
} as const;

export type PermissionCodeValue =
  (typeof PermissionCode)[keyof typeof PermissionCode];

export function getUserPermissionCodes(user: SessionUser | null | undefined) {
  return new Set(user?.role.permissions?.map((permission) => permission.code) ?? []);
}

export function hasPermission(
  user: SessionUser | null | undefined,
  permission: PermissionCodeValue,
) {
  return getUserPermissionCodes(user).has(permission);
}

export function hasAnyPermission(
  user: SessionUser | null | undefined,
  permissions: PermissionCodeValue[],
) {
  const codes = getUserPermissionCodes(user);
  return permissions.some((permission) => codes.has(permission));
}

export function getManageHomePath(user: SessionUser | null | undefined) {
  if (!user) {
    return "/login";
  }

  if (hasPermission(user, PermissionCode.DashboardRead)) {
    return "/manage/dashboard";
  }

  if (hasPermission(user, PermissionCode.TaskAssign)) {
    return "/manage/tasks";
  }

  if (hasPermission(user, PermissionCode.UserManage)) {
    return "/manage/users";
  }

  if (hasPermission(user, PermissionCode.RoleManage)) {
    return "/manage/roles";
  }

  if (hasPermission(user, PermissionCode.PermissionManage)) {
    return "/manage/permissions";
  }

  return "/board";
}
