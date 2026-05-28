import { zodResolver } from "@hookform/resolvers/zod";
import { MoreHorizontalIcon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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
import type { HttpMethod, PermissionSummary, RoleSummary } from "@/types/api";

const PAGE_SIZE = 10;
const methodOptions: HttpMethod[] = ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS", "HEAD"];

const permissionSchema = z.object({
  code: z.string().min(3, "Permission code must be at least 3 characters"),
  name: z.string().min(2, "Permission name must be at least 2 characters"),
  description: z.string().optional(),
  path: z.string().min(1, "Path is required"),
  method: z.enum(["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS", "HEAD"]),
  module: z.string().min(2, "Module is required"),
  roleIds: z.array(z.string()),
});

type PermissionFormValues = z.infer<typeof permissionSchema>;

export default function PermissionsPage() {
  const { t } = useI18n();
  const [permissions, setPermissions] = useState<PermissionSummary[]>([]);
  const [roles, setRoles] = useState<RoleSummary[]>([]);
  const [editingPermission, setEditingPermission] = useState<PermissionSummary | null>(null);
  const [search, setSearch] = useState("");
  const [moduleFilter, setModuleFilter] = useState("ALL");
  const [methodFilter, setMethodFilter] = useState<"ALL" | HttpMethod>("ALL");
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PermissionSummary | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const form = useForm<PermissionFormValues>({
    resolver: zodResolver(permissionSchema),
    defaultValues: {
      code: "",
      name: "",
      description: "",
      path: "",
      method: "GET",
      module: "",
      roleIds: [],
    },
  });

  const moduleOptions = useMemo(
    () => ["ALL", ...Array.from(new Set(permissions.map((permission) => permission.module)))],
    [permissions],
  );

  const filteredPermissions = useMemo(() => {
    const query = search.trim().toLowerCase();

    return permissions.filter((permission) => {
      const matchesSearch =
        query.length === 0 ||
        `${permission.name} ${permission.code} ${permission.path} ${permission.description ?? ""}`
          .toLowerCase()
          .includes(query);
      const matchesModule =
        moduleFilter === "ALL" || permission.module === moduleFilter;
      const matchesMethod =
        methodFilter === "ALL" || permission.method === methodFilter;

      return matchesSearch && matchesModule && matchesMethod;
    });
  }, [methodFilter, moduleFilter, permissions, search]);

  const totalPages = Math.max(1, Math.ceil(filteredPermissions.length / PAGE_SIZE));
  const paginatedPermissions = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredPermissions.slice(start, start + PAGE_SIZE);
  }, [filteredPermissions, page]);

  useEffect(() => {
    setPage(1);
  }, [methodFilter, moduleFilter, search]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  useEffect(() => {
    void loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      setError(null);
      const [permissionsResponse, rolesResponse] = await Promise.all([
        api.get("/permissions"),
        api.get("/roles"),
      ]);
      setPermissions(unwrapEnvelope<PermissionSummary[]>(permissionsResponse.data));
      setRoles(unwrapEnvelope<RoleSummary[]>(rolesResponse.data));
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Unable to load permissions",
      );
    } finally {
      setLoading(false);
    }
  }

  function openCreateDialog() {
    setEditingPermission(null);
    form.reset({
      code: "",
      name: "",
      description: "",
      path: "",
      method: "GET",
      module: "",
      roleIds: [],
    });
    setDialogOpen(true);
  }

  function openEditDialog(permission: PermissionSummary) {
    setEditingPermission(permission);
    form.reset({
      code: permission.code,
      name: permission.name,
      description: permission.description ?? "",
      path: permission.path,
      method: permission.method,
      module: permission.module,
      roleIds: permission.roles.map((role) => role.id),
    });
    setDialogOpen(true);
  }

  async function onSubmit(values: PermissionFormValues) {
    try {
      setError(null);
      if (editingPermission) {
        await api.patch(`/permissions/${editingPermission.id}`, values);
      } else {
        await api.post("/permissions", values);
      }
      setDialogOpen(false);
      await loadData();
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Unable to save permission",
      );
    }
  }

  async function confirmDeletePermission() {
    if (!deleteTarget) {
      return;
    }

    try {
      setIsDeleting(true);
      setError(null);
      await api.delete(`/permissions/${deleteTarget.id}`);
      setDeleteTarget(null);
      await loadData();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error ? deleteError.message : "Unable to delete permission",
      );
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-on-surface">{t("permissions.title")}</h1>
        </div>
        <Button type="button" size="lg" className="h-11 rounded-2xl" onClick={openCreateDialog}>
          <PlusIcon className="size-4" />
          {t("permissions.newPermission")}
        </Button>
      </div>

      {error ? (
        <div className="rounded-2xl border border-error/20 bg-error/10 px-4 py-3 text-sm text-error">
          {error}
        </div>
      ) : null}

      <section className="rounded-[28px] border border-outline-variant bg-surface-container-lowest p-4 sm:p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_200px_180px]">
            <Input
              placeholder={t("permissions.searchPlaceholder")}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />

            <Select
              value={moduleFilter}
              onValueChange={(value) => setModuleFilter(value ?? "ALL")}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t("permissions.allModules")} />
              </SelectTrigger>
              <SelectContent>
                {moduleOptions.map((moduleOption) => (
                  <SelectItem key={moduleOption} value={moduleOption}>
                    {moduleOption === "ALL" ? t("permissions.allModules") : moduleOption}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={methodFilter}
              onValueChange={(value) => setMethodFilter(value as "ALL" | HttpMethod)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t("permissions.allMethods")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">{t("permissions.allMethods")}</SelectItem>
                {methodOptions.map((method) => (
                  <SelectItem key={method} value={method}>
                    {method}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Badge variant="outline">
            {t("permissions.count", { count: filteredPermissions.length })}
          </Badge>
        </div>

        <div className="mt-6 overflow-hidden rounded-[24px] border border-outline-variant/70">
          <Table>
            <TableHeader>
              <TableRow className="bg-surface-container-low">
                <TableHead className="pl-4">{t("permissions.permission")}</TableHead>
                <TableHead className="hidden md:table-cell">{t("permissions.method")}</TableHead>
                <TableHead className="hidden sm:table-cell">{t("permissions.module")}</TableHead>
                <TableHead className="hidden lg:table-cell">{t("permissions.roles")}</TableHead>
                <TableHead className="w-[64px] pr-4 text-right">{t("common.actions")}</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-28 text-center text-on-surface-variant">
                    {t("permissions.loading")}
                  </TableCell>
                </TableRow>
              ) : paginatedPermissions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-28 text-center text-on-surface-variant">
                    {t("permissions.empty")}
                  </TableCell>
                </TableRow>
              ) : (
                paginatedPermissions.map((permission) => (
                  <TableRow key={permission.id}>
                    <TableCell className="min-w-0 pl-4 align-top">
                      <div className="min-w-0 py-1 text-start">
                        <div className="truncate font-medium text-on-surface">
                          {permission.name}
                        </div>
                      </div>
                    </TableCell>

                    <TableCell className="hidden md:table-cell md:align-top">
                      <Badge variant="outline">{permission.method}</Badge>
                    </TableCell>

                    <TableCell className="hidden sm:table-cell sm:align-top">
                      <span className="text-on-surface">{permission.module}</span>
                    </TableCell>

                    <TableCell className="hidden lg:table-cell lg:align-top">
                      <div className="flex max-w-[280px] flex-wrap gap-2">
                        {permission.roles.map((role) => (
                          <Badge key={role.id} variant="outline">
                            {role.name}
                          </Badge>
                        ))}
                      </div>
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
                          <DropdownMenuItem onClick={() => openEditDialog(permission)}>
                            <PencilIcon className="size-4" />
                            {t("common.edit")}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={() => setDeleteTarget(permission)}
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
            {t("permissions.showing", {
              visible: paginatedPermissions.length,
              total: filteredPermissions.length,
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
          <DialogHeader>
            <DialogTitle>
              {editingPermission
                ? t("permissions.editDialogTitle")
                : t("permissions.createDialogTitle")}
            </DialogTitle>
            <DialogDescription>
              {t("permissions.dialogDescription")}
            </DialogDescription>
          </DialogHeader>

          <form className="space-y-5" onSubmit={form.handleSubmit((values) => void onSubmit(values))}>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label={t("permissions.permissionName")} error={form.formState.errors.name?.message}>
                <Input {...form.register("name")} />
              </Field>
              <Field label={t("permissions.code")} error={form.formState.errors.code?.message}>
                <Input {...form.register("code")} />
              </Field>
              <Field label={t("permissions.module")} error={form.formState.errors.module?.message}>
                <Input {...form.register("module")} />
              </Field>
              <Field label={t("permissions.routePath")} error={form.formState.errors.path?.message}>
                <Input {...form.register("path")} />
              </Field>
              <Field label={t("permissions.method")} error={form.formState.errors.method?.message}>
                <select
                  className="h-10 w-full rounded-2xl border border-outline-variant bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-ring focus:ring-3 focus:ring-ring/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  {...form.register("method")}
                >
                  {methodOptions.map((method) => (
                    <option key={method} value={method}>
                      {method}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <Field label={t("roles.description")} error={form.formState.errors.description?.message}>
              <textarea
                className="min-h-28 w-full rounded-2xl border border-outline-variant bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-ring focus:ring-3 focus:ring-ring/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                {...form.register("description")}
              />
            </Field>

            <Controller
              control={form.control}
              name="roleIds"
              render={({ field }) => (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-medium text-on-surface">{t("permissions.attachRoles")}</h3>
                      <p className="text-sm text-on-surface-variant">
                        {t("permissions.attachRolesDescription")}
                      </p>
                    </div>
                    <Badge variant="outline">{t("roles.selected", { count: field.value.length })}</Badge>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    {roles.map((role) => {
                      const checked = field.value.includes(role.id);
                      return (
                        <label
                          key={role.id}
                          className={[
                            "flex items-start gap-3 rounded-2xl border px-3 py-3 transition",
                            checked ? "border-primary bg-primary/8" : "border-outline-variant bg-surface",
                          ].join(" ")}
                        >
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(value) => {
                              const nextSet = new Set(field.value);
                              if (value) {
                                nextSet.add(role.id);
                              } else {
                                nextSet.delete(role.id);
                              }
                              field.onChange(Array.from(nextSet));
                            }}
                          />
                          <span className="space-y-1">
                            <span className="block font-medium text-on-surface">{role.name}</span>
                            <span className="block text-xs uppercase tracking-[0.18em] text-secondary">
                              {role.code}
                            </span>
                            <span className="block text-sm text-on-surface-variant">
                              {t("permissions.usersCount", { count: role.userCount })}
                            </span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            />

            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" size="lg" className="h-11 rounded-2xl px-6" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting
                  ? t("common.saving")
                  : editingPermission
                    ? t("permissions.savePermission")
                    : t("permissions.createPermission")}
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
        title={t("permissions.deleteTitle")}
        description={deleteTarget ? t("permissions.deleteDescription", { name: deleteTarget.name }) : ""}
        confirmLabel={t("permissions.deleteConfirm")}
        isLoading={isDeleting}
        onConfirm={confirmDeletePermission}
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
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-on-surface">{label}</label>
      {children}
      {error ? <p className="mt-2 text-sm text-error">{error}</p> : null}
    </div>
  );
}
