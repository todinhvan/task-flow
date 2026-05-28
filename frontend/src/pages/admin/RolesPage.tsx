import { zodResolver } from "@hookform/resolvers/zod";
import {
  ChevronDownIcon,
  MoreHorizontalIcon,
  PencilIcon,
  ShieldCheckIcon,
  Trash2Icon,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import DataTablePagination from "@/components/ui/data-table-pagination";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import type { PermissionSummary, RoleCode, RoleSummary } from "@/types/api";

const PAGE_SIZE = 8;
const roleCodeOptions: RoleCode[] = ["ADMIN", "MANAGER", "EMPLOYEE"];

const roleSchema = z.object({
  code: z.enum(["ADMIN", "MANAGER", "EMPLOYEE"]),
  name: z.string().min(2, "Role name must be at least 2 characters"),
  description: z.string().optional(),
  isActive: z.boolean(),
  permissionIds: z.array(z.string()),
});

type RoleFormValues = z.infer<typeof roleSchema>;

export default function RolesPage() {
  const { t } = useI18n();
  const [roles, setRoles] = useState<RoleSummary[]>([]);
  const [permissions, setPermissions] = useState<PermissionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleSummary | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RoleSummary | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [expandedPermissionModules, setExpandedPermissionModules] = useState<string[]>([]);

  const form = useForm<RoleFormValues>({
    resolver: zodResolver(roleSchema),
    defaultValues: {
      code: "EMPLOYEE",
      name: "",
      description: "",
      isActive: true,
      permissionIds: [],
    },
  });

  const groupedPermissions = useMemo(() => {
    return permissions.reduce<Record<string, PermissionSummary[]>>((accumulator, permission) => {
      accumulator[permission.module] ??= [];
      accumulator[permission.module].push(permission);
      return accumulator;
    }, {});
  }, [permissions]);

  const availableCodes = useMemo(() => {
    const activeCodes = new Set(roles.map((role) => role.code));
    return roleCodeOptions.filter((code) => !activeCodes.has(code) || code === editingRole?.code);
  }, [editingRole?.code, roles]);

  useEffect(() => {
    void loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      setError(null);
      const [rolesResponse, permissionsResponse] = await Promise.all([
        api.get("/roles"),
        api.get("/permissions"),
      ]);
      setRoles(unwrapEnvelope<RoleSummary[]>(rolesResponse.data));
      setPermissions(unwrapEnvelope<PermissionSummary[]>(permissionsResponse.data));
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Unable to load roles",
      );
    } finally {
      setLoading(false);
    }
  }

  const filteredRoles = useMemo(() => {
    const query = search.trim().toLowerCase();

    return roles.filter((role) => {
      const matchesSearch =
        query.length === 0 ||
        `${role.name} ${role.code} ${role.description ?? ""}`
          .toLowerCase()
          .includes(query);
      const matchesStatus =
        statusFilter === "ALL" ||
        (statusFilter === "ACTIVE" ? role.isActive : !role.isActive);

      return matchesSearch && matchesStatus;
    });
  }, [roles, search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredRoles.length / PAGE_SIZE));
  const paginatedRoles = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredRoles.slice(start, start + PAGE_SIZE);
  }, [filteredRoles, page]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  function openCreateDialog() {
    setEditingRole(null);
    setExpandedPermissionModules([]);
    form.reset({
      code: availableCodes[0] ?? "EMPLOYEE",
      name: "",
      description: "",
      isActive: true,
      permissionIds: [],
    });
    setDialogOpen(true);
  }

  function openEditDialog(role: RoleSummary) {
    setEditingRole(role);
    setExpandedPermissionModules([]);
    form.reset({
      code: role.code,
      name: role.name,
      description: role.description ?? "",
      isActive: role.isActive,
      permissionIds: role.permissions.map((permission) => permission.id),
    });
    setDialogOpen(true);
  }

  async function onSubmit(values: RoleFormValues) {
    try {
      setError(null);
      if (editingRole) {
        await api.patch(`/roles/${editingRole.id}`, values);
      } else {
        await api.post("/roles", values);
      }
      setDialogOpen(false);
      await loadData();
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Unable to save role",
      );
    }
  }

  async function confirmDeleteRole() {
    if (!deleteTarget) {
      return;
    }

    try {
      setIsDeleting(true);
      setError(null);
      await api.delete(`/roles/${deleteTarget.id}`);
      setDeleteTarget(null);
      await loadData();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error ? deleteError.message : "Unable to delete role",
      );
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-on-surface">{t("roles.title")}</h1>
        </div>
        <Button type="button" size="lg" className="h-11 rounded-2xl" onClick={openCreateDialog}>
          <ShieldCheckIcon className="size-4" />
          {t("roles.newRole")}
        </Button>
      </div>

      {error ? (
        <div className="rounded-2xl border border-error/20 bg-error/10 px-4 py-3 text-sm text-error">
          {error}
        </div>
      ) : null}

      <section className="rounded-[28px] border border-outline-variant bg-surface-container-lowest p-4 sm:p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_220px]">
            <Input
              placeholder={t("roles.searchPlaceholder")}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />

            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as typeof statusFilter)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t("common.allStatuses")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">{t("common.allStatuses")}</SelectItem>
                <SelectItem value="ACTIVE">{t("status.active")}</SelectItem>
                <SelectItem value="INACTIVE">{t("status.inactive")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Badge variant="outline">{t("roles.count", { count: filteredRoles.length })}</Badge>
        </div>

        <div className="mt-6 overflow-hidden rounded-[24px] border border-outline-variant/70">
          <Table>
            <TableHeader>
              <TableRow className="bg-surface-container-low">
                <TableHead className="pl-4">{t("users.role")}</TableHead>
                <TableHead className="hidden md:table-cell">{t("roles.permissions")}</TableHead>
                <TableHead className="hidden sm:table-cell">{t("roles.users")}</TableHead>
                <TableHead>{t("users.status")}</TableHead>
                <TableHead className="w-[64px] pr-4 text-right">{t("common.actions")}</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-28 text-center text-on-surface-variant">
                    {t("roles.loading")}
                  </TableCell>
                </TableRow>
              ) : paginatedRoles.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-28 text-center text-on-surface-variant">
                    {t("roles.empty")}
                  </TableCell>
                </TableRow>
              ) : (
                paginatedRoles.map((role) => (
                  <TableRow key={role.id}>
                    <TableCell className="min-w-0 pl-4 align-top">
                      <div className="min-w-0 py-1 text-start">
                        <div className="truncate font-medium text-on-surface">{role.name}</div>
                      </div>
                    </TableCell>

                    <TableCell className="hidden md:table-cell md:align-top">
                      <div className="flex max-w-[360px] flex-wrap gap-2">
                        {role.permissions.slice(0, 3).map((permission) => (
                          <Badge key={permission.id} variant="outline">
                            {permission.name}
                          </Badge>
                        ))}
                        {role.permissions.length > 3 ? (
                          <Badge variant="outline">+{role.permissions.length - 3}</Badge>
                        ) : null}
                      </div>
                    </TableCell>

                    <TableCell className="hidden sm:table-cell sm:align-top">
                      <span className="text-on-surface">{role.userCount}</span>
                    </TableCell>

                    <TableCell className="align-top">
                      <Badge variant={role.isActive ? "default" : "outline"}>
                        {role.isActive ? t("status.active") : t("status.inactive")}
                      </Badge>
                    </TableCell>

                    <TableCell className="pr-4 align-top text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={<Button type="button" variant="ghost" size="icon-xs" />}
                        >
                          <MoreHorizontalIcon className="size-4" />
                          <span className="sr-only">{t("common.openActions")}</span>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEditDialog(role)}>
                            <PencilIcon className="size-4" />
                            {t("common.edit")}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            variant="destructive"
                            disabled={role.userCount > 0}
                            onClick={() => setDeleteTarget(role)}
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
            {t("roles.showing", {
              visible: paginatedRoles.length,
              total: filteredRoles.length,
            })}
          </p>
          <DataTablePagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </div>
      </section>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-4xl lg:max-w-5xl">
          <DialogHeader className="pr-10">
            <DialogTitle>
              {editingRole ? t("roles.editDialogTitle") : t("roles.createDialogTitle")}
            </DialogTitle>
            <DialogDescription>
              {t("roles.dialogDescription")}
            </DialogDescription>
          </DialogHeader>

          <form className="space-y-6" onSubmit={form.handleSubmit((values) => void onSubmit(values))}>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label={t("roles.roleCode")} error={form.formState.errors.code?.message}>
                <select
                  className="h-10 w-full rounded-2xl border border-outline-variant bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-ring focus:ring-3 focus:ring-ring/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  {...form.register("code")}
                  disabled={Boolean(editingRole)}
                >
                  {availableCodes.map((code) => (
                    <option key={code} value={code}>
                      {code}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label={t("roles.roleName")} error={form.formState.errors.name?.message}>
                <Input {...form.register("name")} />
              </Field>
            </div>

            <Field label={t("roles.description")} error={form.formState.errors.description?.message}>
              <textarea
                className="min-h-24 w-full rounded-2xl border border-outline-variant bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-ring focus:ring-3 focus:ring-ring/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                {...form.register("description")}
              />
            </Field>

            <Controller
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <label className="flex items-center gap-3 rounded-2xl border border-outline-variant px-4 py-3 text-sm text-on-surface">
                  <Checkbox checked={field.value} onCheckedChange={(value) => field.onChange(Boolean(value))} />
                  {t("roles.keepActive")}
                </label>
              )}
            />

            <Controller
              control={form.control}
              name="permissionIds"
              render={({ field }) => (
                <div className="space-y-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-on-surface">{t("roles.permissionBundle")}</h3>
                      <p className="text-sm text-on-surface-variant">
                        {t("roles.permissionBundleDescription")}
                      </p>
                    </div>
                    <Badge variant="outline">{t("roles.selected", { count: field.value.length })}</Badge>
                  </div>

                  <div className="space-y-4">
                    {Object.entries(groupedPermissions).map(([moduleName, modulePermissions]) => (
                      <div key={moduleName} className="rounded-[24px] border border-outline-variant bg-surface px-4 py-4">
                        <button
                          type="button"
                          className="flex w-full items-center justify-between gap-3 text-left"
                          onClick={() =>
                            setExpandedPermissionModules((current) =>
                              current.includes(moduleName)
                                ? current.filter((item) => item !== moduleName)
                                : [...current, moduleName],
                            )
                          }
                        >
                          <div>
                            <h4 className="font-medium text-on-surface">{moduleName}</h4>
                            <p className="text-sm text-on-surface-variant">
                              {modulePermissions.length} permissions
                            </p>
                          </div>
                          <ChevronDownIcon
                            className={[
                              "size-5 text-on-surface-variant transition-transform",
                              expandedPermissionModules.includes(moduleName) ? "rotate-180" : "",
                            ].join(" ")}
                          />
                        </button>

                        {expandedPermissionModules.includes(moduleName) ? (
                          <div className="mt-4 space-y-4">
                            <div className="flex justify-end">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  const nextSet = new Set(field.value);
                                  const everySelected = modulePermissions.every((permission) =>
                                    nextSet.has(permission.id),
                                  );
                                  modulePermissions.forEach((permission) => {
                                    if (everySelected) {
                                      nextSet.delete(permission.id);
                                    } else {
                                      nextSet.add(permission.id);
                                    }
                                  });
                                  field.onChange(Array.from(nextSet));
                                }}
                              >
                                {t("roles.toggleAll")}
                              </Button>
                            </div>

                            <div className="grid gap-3 xl:grid-cols-2">
                              {modulePermissions.map((permission) => {
                                const checked = field.value.includes(permission.id);
                                return (
                                  <label
                                    key={permission.id}
                                    className={[
                                      "flex items-start gap-3 rounded-2xl border px-3 py-3 transition",
                                      checked ? "border-primary bg-primary/8" : "border-outline-variant bg-surface-container-lowest",
                                    ].join(" ")}
                                  >
                                    <Checkbox
                                      checked={checked}
                                      onCheckedChange={(value) => {
                                        const nextSet = new Set(field.value);
                                        if (value) {
                                          nextSet.add(permission.id);
                                        } else {
                                          nextSet.delete(permission.id);
                                        }
                                        field.onChange(Array.from(nextSet));
                                      }}
                                    />
                                    <span className="space-y-1">
                                      <span className="block font-medium text-on-surface">{permission.name}</span>
                                      <span className="block break-all text-xs uppercase tracking-[0.18em] text-secondary">
                                        {permission.method} {permission.path}
                                      </span>
                                      <span className="block text-sm text-on-surface-variant">
                                        {permission.description ?? permission.code}
                                      </span>
                                    </span>
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            />

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" size="lg" className="h-11 rounded-2xl px-6" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting
                  ? t("common.saving")
                  : editingRole
                    ? t("roles.saveRole")
                    : t("roles.createRole")}
              </Button>
            </div>
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
        title={t("roles.deleteTitle")}
        description={deleteTarget ? t("roles.deleteDescription", { name: deleteTarget.name }) : ""}
        confirmLabel={t("roles.deleteConfirm")}
        isLoading={isDeleting}
        onConfirm={confirmDeleteRole}
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
      <label className="mb-2 block text-sm font-medium text-on-surface">{label}</label>
      {children}
      {error ? <p className="mt-2 text-sm text-error">{error}</p> : null}
    </div>
  );
}
