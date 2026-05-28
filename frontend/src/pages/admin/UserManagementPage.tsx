import { zodResolver } from "@hookform/resolvers/zod";
import {
  MoreHorizontalIcon,
  PencilIcon,
  Trash2Icon,
  UserPlusIcon,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import DataTablePagination from "@/components/ui/data-table-pagination";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useI18n } from "@/context/I18nContext";
import { api, unwrapEnvelope } from "@/lib/api";
import { formatUserStatus } from "@/lib/display";
import { resizeImageFile } from "@/lib/files";
import type { RoleCode, RoleSummary, UserStatus, UserSummary } from "@/types/api";

const PAGE_SIZE = 8;

const userSchema = z.object({
  fullName: z.string().min(2, "Full name must be at least 2 characters"),
  email: z.email("Enter a valid email address"),
  password: z.string().optional(),
  roleCode: z.string().min(1, "Select a role"),
  status: z.enum(["ACTIVE", "INACTIVE", "BLOCKED"]),
  phoneNumber: z.string().optional(),
  jobTitle: z.string().optional(),
  department: z.string().optional(),
  location: z.string().optional(),
  dateOfBirth: z.string().optional(),
  bio: z.string().optional(),
});

type UserFormValues = z.infer<typeof userSchema>;

export default function UserManagementPage() {
  const { t } = useI18n();
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [roles, setRoles] = useState<RoleSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"ALL" | RoleCode>("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | UserStatus>("ALL");
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserSummary | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UserSummary | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const form = useForm<UserFormValues>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      fullName: "",
      email: "",
      password: "",
      roleCode: "EMPLOYEE",
      status: "ACTIVE",
      phoneNumber: "",
      jobTitle: "",
      department: "",
      location: "",
      dateOfBirth: "",
      bio: "",
    },
  });

  useEffect(() => {
    void loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      setError(null);
      const [usersResponse, rolesResponse] = await Promise.all([
        api.get("/users"),
        api.get("/roles", {
          params: {
            includeInactive: true,
          },
        }),
      ]);

      setUsers(unwrapEnvelope<UserSummary[]>(usersResponse.data));
      setRoles(unwrapEnvelope<RoleSummary[]>(rolesResponse.data));
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Unable to load users",
      );
    } finally {
      setLoading(false);
    }
  }

  const roleOptions = useMemo(
    () => ["ALL", ...new Set(users.map((user) => user.role.code))] as Array<"ALL" | RoleCode>,
    [users],
  );

  const availableRoleOptions = useMemo(
    () =>
      roles
        .filter((role) => role.isActive || role.code === form.getValues("roleCode"))
        .map((role) => ({
          value: role.code,
          label: role.isActive ? role.name : `${role.name} (${t("status.inactive")})`,
        })),
    [form, roles],
  );

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();

    return users.filter((user) => {
      const matchesSearch =
        query.length === 0 ||
        [
          user.profile.fullName,
          user.email,
          user.profile.jobTitle ?? "",
          user.profile.department ?? "",
        ]
          .join(" ")
          .toLowerCase()
          .includes(query);
      const matchesRole = roleFilter === "ALL" || user.role.code === roleFilter;
      const matchesStatus =
        statusFilter === "ALL" || user.status === statusFilter;

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [roleFilter, search, statusFilter, users]);

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE));
  const paginatedUsers = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredUsers.slice(start, start + PAGE_SIZE);
  }, [filteredUsers, page]);

  useEffect(() => {
    setPage(1);
  }, [roleFilter, search, statusFilter]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  function openCreateDialog() {
    setEditingUser(null);
    setAvatarFile(null);
    setAvatarPreview(null);
    form.reset({
      fullName: "",
      email: "",
      password: "",
      roleCode: availableRoleOptions[0]?.value ?? "EMPLOYEE",
      status: "ACTIVE",
      phoneNumber: "",
      jobTitle: "",
      department: "",
      location: "",
      dateOfBirth: "",
      bio: "",
    });
    setDialogOpen(true);
  }

  function openEditDialog(user: UserSummary) {
    setEditingUser(user);
    setAvatarFile(null);
    setAvatarPreview(user.profile.avatarUrl ?? null);
    form.reset({
      fullName: user.profile.fullName,
      email: user.email,
      password: "",
      roleCode: user.role.code,
      status: user.status,
      phoneNumber: user.profile.phoneNumber ?? "",
      jobTitle: user.profile.jobTitle ?? "",
      department: user.profile.department ?? "",
      location: user.profile.location ?? "",
      dateOfBirth: user.profile.dateOfBirth
        ? user.profile.dateOfBirth.slice(0, 10)
        : "",
      bio: user.profile.bio ?? "",
    });
    setDialogOpen(true);
  }

  async function handleAvatar(file: File | null) {
    if (!file) {
      return;
    }

    try {
      const resized = await resizeImageFile(file, {
        maxWidth: 512,
        maxHeight: 512,
      });
      setAvatarFile(resized);
      setAvatarPreview(URL.createObjectURL(resized));
      setError(null);
    } catch (fileError) {
      setError(fileError instanceof Error ? fileError.message : "Invalid image");
    }
  }

  async function onSubmit(values: UserFormValues) {
    try {
      setError(null);

      if (!editingUser && (!values.password || values.password.length < 8)) {
        setError("Password must be at least 8 characters");
        return;
      }

      const formData = new FormData();
      const nullableKeys = new Set([
        "phoneNumber",
        "jobTitle",
        "department",
        "location",
        "dateOfBirth",
        "bio",
      ]);

      Object.entries(values).forEach(([key, value]) => {
        if (key === "password" && editingUser && !value) {
          return;
        }

        if (nullableKeys.has(key)) {
          formData.append(key, value ?? "");
          return;
        }

        if (value) {
          formData.append(key, value);
        }
      });

      if (avatarFile) {
        formData.append("avatar", avatarFile);
      }

      if (editingUser) {
        await api.patch(`/users/${editingUser.id}`, formData, {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        });
      } else {
        await api.post("/users", formData, {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        });
      }

      setDialogOpen(false);
      await loadData();
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Unable to save user",
      );
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) {
      return;
    }

    try {
      setIsDeleting(true);
      setError(null);
      await api.delete(`/users/${deleteTarget.id}`);
      setDeleteTarget(null);
      await loadData();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Unable to delete user",
      );
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-on-surface">{t("users.title")}</h1>
        </div>
        <Button type="button" size="lg" className="h-11 rounded-2xl" onClick={openCreateDialog}>
          <UserPlusIcon className="size-4" />
          {t("users.createUser")}
        </Button>
      </div>

      {error ? (
        <div className="rounded-2xl border border-error/20 bg-error/10 px-4 py-3 text-sm text-error">
          {error}
        </div>
      ) : null}

      <section className="rounded-[28px] border border-outline-variant bg-surface-container-lowest p-4 sm:p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1.5fr)_200px_200px]">
            <Input
              placeholder={t("users.searchPlaceholder")}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="w-full"
            />

            <Select
              value={roleFilter}
              onValueChange={(value) => setRoleFilter(value as "ALL" | RoleCode)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t("users.allRoles")} />
              </SelectTrigger>
              <SelectContent>
                {roleOptions.map((role) => (
                  <SelectItem key={role} value={role}>
                    {role === "ALL" ? t("users.allRoles") : role}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={statusFilter}
              onValueChange={(value) =>
                setStatusFilter(value as "ALL" | UserStatus)
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t("common.allStatuses")} />
              </SelectTrigger>
              <SelectContent>
                {(["ALL", "ACTIVE", "INACTIVE", "BLOCKED"] as const).map((status) => (
                  <SelectItem key={status} value={status}>
                    {status === "ALL" ? t("common.allStatuses") : formatUserStatus(status, t)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Badge variant="outline">
            {t("users.count", { count: filteredUsers.length })}
          </Badge>
        </div>

        <div className="mt-6 overflow-hidden rounded-[24px] border border-outline-variant/70">
          <Table>
            <TableHeader>
              <TableRow className="bg-surface-container-low">
                <TableHead className="pl-4">{t("users.user")}</TableHead>
                <TableHead className="hidden md:table-cell">{t("users.email")}</TableHead>
                <TableHead className="hidden sm:table-cell">{t("users.role")}</TableHead>
                <TableHead>{t("users.status")}</TableHead>
                <TableHead className="w-[64px] pr-4 text-right">{t("common.actions")}</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-28 text-center text-on-surface-variant">
                    {t("users.loading")}
                  </TableCell>
                </TableRow>
              ) : paginatedUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-28 text-center text-on-surface-variant">
                    {t("users.empty")}
                  </TableCell>
                </TableRow>
              ) : (
                paginatedUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="min-w-0 pl-4 align-top">
                      <div className="min-w-0 py-1 text-start">
                        <div className="truncate font-medium text-on-surface">
                          {user.profile.fullName}
                        </div>
                      </div>
                    </TableCell>

                    <TableCell className="hidden max-w-[280px] md:table-cell md:align-top">
                      <span className="block break-all text-on-surface-variant">
                        {user.email}
                      </span>
                    </TableCell>

                    <TableCell className="hidden sm:table-cell sm:align-top">
                      <Badge variant="outline">{user.role.name}</Badge>
                    </TableCell>

                    <TableCell className="align-top">
                      <Badge variant={statusVariant(user.status)}>
                        {formatUserStatus(user.status, t)}
                      </Badge>
                    </TableCell>

                    <TableCell className="pr-4 align-top text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <Button type="button" variant="ghost" size="icon-xs" />
                          }
                        >
                          <MoreHorizontalIcon className="size-4" />
                          <span className="sr-only">{t("common.openActions")}</span>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEditDialog(user)}>
                            <PencilIcon className="size-4" />
                            {t("common.edit")}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={() => setDeleteTarget(user)}
                          >
                            <Trash2Icon className="size-4" />
                            {t("common.delete")}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-on-surface-variant">
            {t("users.showing", {
              visible: paginatedUsers.length,
              total: filteredUsers.length,
            })}
          </p>
          <DataTablePagination
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
          />
        </div>
      </section>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-3xl lg:max-w-4xl">
          <DialogHeader className="pr-10">
            <DialogTitle>
              {editingUser ? t("users.editDialogTitle") : t("users.createDialogTitle")}
            </DialogTitle>
            <DialogDescription>
              {t("users.dialogDescription")}
            </DialogDescription>
          </DialogHeader>

          <form className="space-y-5" onSubmit={form.handleSubmit((values) => void onSubmit(values))}>
            <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
              <section className="rounded-[24px] border border-outline-variant bg-surface p-5">
                <div className="flex flex-col items-center">
                  <div className="size-28 overflow-hidden rounded-full border border-outline-variant bg-surface-container">
                    {avatarPreview ? (
                      <img
                        src={avatarPreview}
                        alt={t("profile.avatarPreviewAlt")}
                        className="size-full object-cover"
                      />
                    ) : (
                      <div className="flex size-full items-center justify-center text-3xl font-semibold text-secondary">
                        {form.watch("fullName").slice(0, 2).toUpperCase() || "US"}
                      </div>
                    )}
                  </div>
                  <label className="mt-4 inline-flex cursor-pointer items-center rounded-2xl border border-outline-variant px-4 py-2 text-sm font-medium text-on-surface transition hover:bg-surface-container-low">
                    {t("users.uploadAvatar")}
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                      onChange={(event) =>
                        void handleAvatar(event.target.files?.[0] ?? null)
                      }
                    />
                  </label>
                </div>
              </section>

              <section className="space-y-5">
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label={t("auth.fullName")} error={form.formState.errors.fullName?.message}>
                    <Input {...form.register("fullName")} />
                  </Field>
                  <Field label={t("auth.email")} error={form.formState.errors.email?.message}>
                    <Input type="email" {...form.register("email")} />
                  </Field>
                  <Field
                    label={editingUser ? t("users.newPassword") : t("common.password")}
                    error={form.formState.errors.password?.message}
                  >
                    <Input type="password" {...form.register("password")} />
                  </Field>
                  <Field label={t("users.role")} error={form.formState.errors.roleCode?.message}>
                    <select
                      className="h-10 w-full rounded-2xl border border-outline-variant bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-ring focus:ring-3 focus:ring-ring/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                      {...form.register("roleCode")}
                    >
                      {availableRoleOptions.map((role) => (
                        <option key={role.value} value={role.value}>
                          {role.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label={t("users.status")} error={form.formState.errors.status?.message}>
                    <select
                      className="h-10 w-full rounded-2xl border border-outline-variant bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-ring focus:ring-3 focus:ring-ring/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                      {...form.register("status")}
                    >
                      {(["ACTIVE", "INACTIVE", "BLOCKED"] as const).map((status) => (
                        <option key={status} value={status}>
                          {formatUserStatus(status, t)}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label={t("users.phoneNumber")} error={form.formState.errors.phoneNumber?.message}>
                    <Input {...form.register("phoneNumber")} />
                  </Field>
                  <Field label={t("users.jobTitle")} error={form.formState.errors.jobTitle?.message}>
                    <Input {...form.register("jobTitle")} />
                  </Field>
                  <Field label={t("users.department")} error={form.formState.errors.department?.message}>
                    <Input {...form.register("department")} />
                  </Field>
                  <Field label={t("users.location")} error={form.formState.errors.location?.message}>
                    <Input {...form.register("location")} />
                  </Field>
                  <Field label={t("users.dateOfBirth")} error={form.formState.errors.dateOfBirth?.message}>
                    <Input type="date" {...form.register("dateOfBirth")} />
                  </Field>
                </div>

                <Field label={t("users.bio")} error={form.formState.errors.bio?.message}>
                  <textarea
                    className="min-h-28 w-full rounded-2xl border border-outline-variant bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-ring focus:ring-3 focus:ring-ring/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    {...form.register("bio")}
                  />
                </Field>
              </section>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" size="lg" className="h-11 rounded-2xl px-6" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting
                  ? t("common.saving")
                  : editingUser
                    ? t("users.saveUser")
                    : t("users.createUser")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
          }
        }}
        title={t("users.deleteTitle")}
        description={
          deleteTarget
            ? t("users.deleteDescription", { name: deleteTarget.profile.fullName })
            : ""
        }
        confirmLabel={t("users.deleteConfirm")}
        isLoading={isDeleting}
        onConfirm={confirmDelete}
      />
    </div>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-on-surface">
        {label}
      </label>
      {children}
      {error ? <p className="mt-2 text-sm text-error">{error}</p> : null}
    </div>
  );
}

function statusVariant(status: UserStatus): "default" | "outline" | "destructive" {
  if (status === "ACTIVE") {
    return "default";
  }

  if (status === "BLOCKED") {
    return "destructive";
  }

  return "outline";
}
