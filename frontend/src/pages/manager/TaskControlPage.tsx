import { zodResolver } from "@hookform/resolvers/zod";
import {
  MoreHorizontalIcon,
  PaperclipIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
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
import { useRealtime } from "@/context/RealtimeContext";
import { api, unwrapEnvelope } from "@/lib/api";
import { formatTaskPriority, formatUserStatus } from "@/lib/display";
import {
  resizeImageFile,
  validateAttachmentFiles,
  validateImageFile,
} from "@/lib/files";
import type { EmployeeOption, Task, TaskPriority, TaskStatus } from "@/types/api";

const PAGE_SIZE = 8;

const taskSchema = z.object({
  title: z.string().min(2, "Title must be at least 2 characters"),
  description: z.string().optional(),
  assigneeId: z.string().min(1, "Select an employee"),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]),
  status: z.enum(["TODO", "IN_PROGRESS", "BLOCKED", "DONE"]),
  dueDate: z.string().optional(),
});

type TaskFormValues = z.infer<typeof taskSchema>;

const priorityOptions: TaskPriority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];
const statusOptions: TaskStatus[] = ["TODO", "IN_PROGRESS", "BLOCKED", "DONE"];

export default function TaskControlPage() {
  const { t } = useI18n();
  const { lastEvent } = useRealtime();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("ALL");
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Task | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const form = useForm<TaskFormValues>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      title: "",
      description: "",
      assigneeId: "",
      priority: "MEDIUM",
      status: "TODO",
      dueDate: "",
    },
  });

  useEffect(() => {
    void loadData();
  }, []);

  useEffect(() => {
    if (!lastEvent) {
      return;
    }

    void loadData();
  }, [lastEvent]);

  async function loadData() {
    try {
      setLoading(true);
      setError(null);
      const [tasksResponse, employeesResponse] = await Promise.all([
        api.get("/tasks"),
        api.get("/users/options/employees"),
      ]);
      setTasks(unwrapEnvelope<Task[]>(tasksResponse.data));
      setEmployees(unwrapEnvelope<EmployeeOption[]>(employeesResponse.data));
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Unable to load tasks",
      );
    } finally {
      setLoading(false);
    }
  }

  const filteredTasks = useMemo(() => {
    const query = search.trim().toLowerCase();

    return tasks.filter((task) => {
      const matchesSearch =
        query.length === 0 ||
        `${task.title} ${task.description ?? ""}`
          .toLowerCase()
          .includes(query);
      const matchesStatus =
        statusFilter === "ALL" || task.status === statusFilter;
      const matchesAssignee =
        assigneeFilter === "ALL" || task.assignee.id === assigneeFilter;

      return matchesSearch && matchesStatus && matchesAssignee;
    });
  }, [assigneeFilter, search, statusFilter, tasks]);

  const totalPages = Math.max(1, Math.ceil(filteredTasks.length / PAGE_SIZE));
  const paginatedTasks = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredTasks.slice(start, start + PAGE_SIZE);
  }, [filteredTasks, page]);

  useEffect(() => {
    setPage(1);
  }, [assigneeFilter, search, statusFilter]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  function openCreateDialog() {
    setEditingTask(null);
    setPendingFiles([]);
    form.reset({
      title: "",
      description: "",
      assigneeId: employees[0]?.id ?? "",
      priority: "MEDIUM",
      status: "TODO",
      dueDate: "",
    });
    setDialogOpen(true);
  }

  function openEditDialog(task: Task) {
    setEditingTask(task);
    setPendingFiles([]);
    form.reset({
      title: task.title,
      description: task.description ?? "",
      assigneeId: task.assignee.id,
      priority: task.priority,
      status: task.status,
      dueDate: task.dueDate ? task.dueDate.slice(0, 10) : "",
    });
    setDialogOpen(true);
  }

  async function onFilesSelected(files: FileList | null) {
    if (!files) {
      return;
    }

    try {
      const selected = Array.from(files);
      validateAttachmentFiles(selected);

      const prepared = await Promise.all(
        selected.map(async (file) => {
          if (!file.type.startsWith("image/")) {
            return file;
          }

          validateImageFile(file);
          return resizeImageFile(file, {
            maxWidth: 1600,
            maxHeight: 1600,
          });
        }),
      );

      setPendingFiles(prepared);
    } catch (fileError) {
      setError(fileError instanceof Error ? fileError.message : "Invalid file");
    }
  }

  async function onSubmit(values: TaskFormValues) {
    try {
      setError(null);

      if (editingTask) {
        await api.patch(`/tasks/${editingTask.id}`, values);

        if (pendingFiles.length > 0) {
          const formData = new FormData();
          pendingFiles.forEach((file) => formData.append("attachments", file));
          await api.post(`/tasks/${editingTask.id}/attachments`, formData, {
            headers: {
              "Content-Type": "multipart/form-data",
            },
          });
        }
      } else {
        const formData = new FormData();
        Object.entries(values).forEach(([key, value]) => {
          if (value) {
            formData.append(key, value);
          }
        });
        formData.append("source", "MANAGER_ASSIGNED");
        pendingFiles.forEach((file) => formData.append("attachments", file));
        await api.post("/tasks", formData, {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        });
      }

      setDialogOpen(false);
      await loadData();
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Unable to save task",
      );
    }
  }

  async function confirmDeleteTask() {
    if (!deleteTarget) {
      return;
    }

    try {
      setIsDeleting(true);
      setError(null);
      await api.delete(`/tasks/${deleteTarget.id}`);
      setDeleteTarget(null);
      await loadData();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Unable to delete task",
      );
    } finally {
      setIsDeleting(false);
    }
  }

  async function onDeleteAttachment(taskId: string, attachmentId: string) {
    try {
      await api.delete(`/tasks/${taskId}/attachments/${attachmentId}`);
      await loadData();
      if (editingTask?.id === taskId) {
        const refreshed = await api.get(`/tasks/${taskId}`);
        const task = unwrapEnvelope<Task>(refreshed.data);
        setEditingTask(task);
        form.reset({
          title: task.title,
          description: task.description ?? "",
          assigneeId: task.assignee.id,
          priority: task.priority,
          status: task.status,
          dueDate: task.dueDate ? task.dueDate.slice(0, 10) : "",
        });
      }
    } catch (attachmentError) {
      setError(
        attachmentError instanceof Error
          ? attachmentError.message
          : "Unable to delete attachment",
      );
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-on-surface">{t("tasks.title")}</h1>
        </div>
        <Button type="button" size="lg" className="h-11 rounded-2xl" onClick={openCreateDialog}>
          <PlusIcon className="size-4" />
          {t("tasks.createTask")}
        </Button>
      </div>

      {error ? (
        <div className="rounded-2xl border border-error/20 bg-error/10 px-4 py-3 text-sm text-error">
          {error}
        </div>
      ) : null}

      <section className="rounded-[28px] border border-outline-variant bg-surface-container-lowest p-4 sm:p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_200px_240px]">
            <Input
              placeholder={t("tasks.searchPlaceholder")}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />

            <Select
              value={statusFilter}
              onValueChange={(value) => setStatusFilter(value ?? "ALL")}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t("common.allStatuses")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">{t("common.allStatuses")}</SelectItem>
                {statusOptions.map((status) => (
                <SelectItem key={status} value={status}>
                    {formatUserStatus(status, t)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={assigneeFilter}
              onValueChange={(value) => setAssigneeFilter(value ?? "ALL")}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t("tasks.allEmployees")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">{t("tasks.allEmployees")}</SelectItem>
                {employees.map((employee) => (
                  <SelectItem key={employee.id} value={employee.id}>
                    {employee.fullName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Badge variant="outline">{t("tasks.count", { count: filteredTasks.length })}</Badge>
        </div>

        <div className="mt-6 overflow-hidden rounded-[24px] border border-outline-variant/70">
          <Table>
            <TableHeader>
              <TableRow className="bg-surface-container-low">
                <TableHead className="pl-4">{t("tasks.task")}</TableHead>
                <TableHead className="hidden md:table-cell">{t("tasks.assignee")}</TableHead>
                <TableHead className="hidden lg:table-cell">{t("tasks.priority")}</TableHead>
                <TableHead>{t("users.status")}</TableHead>
                <TableHead className="hidden xl:table-cell">{t("tasks.dueDate")}</TableHead>
                <TableHead className="w-[64px] pr-4 text-right">{t("common.actions")}</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-28 text-center text-on-surface-variant">
                    {t("tasks.loading")}
                  </TableCell>
                </TableRow>
              ) : paginatedTasks.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-28 text-center text-on-surface-variant">
                    {t("tasks.empty")}
                  </TableCell>
                </TableRow>
              ) : (
                paginatedTasks.map((task) => (
                  <TableRow key={task.id}>
                    <TableCell className="min-w-0 pl-4 align-top">
                      <div className="min-w-0 py-1 text-start">
                        <div className="truncate font-medium text-on-surface">{task.title}</div>
                      </div>
                    </TableCell>

                    <TableCell className="hidden md:table-cell md:align-top">
                      <span className="text-on-surface">{task.assignee.fullName}</span>
                    </TableCell>

                    <TableCell className="hidden lg:table-cell lg:align-top">
                      <Badge variant="outline">{formatTaskPriority(task.priority, t)}</Badge>
                    </TableCell>

                    <TableCell className="align-top">
                      <Badge variant={task.status === "DONE" ? "default" : "outline"}>
                        {formatUserStatus(task.status, t)}
                      </Badge>
                    </TableCell>

                    <TableCell className="hidden xl:table-cell xl:align-top">
                      <span className="text-on-surface-variant">
                        {task.dueDate ? task.dueDate.slice(0, 10) : t("dashboard.noDueDate")}
                      </span>
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
                          <DropdownMenuItem onClick={() => openEditDialog(task)}>
                            <PencilIcon className="size-4" />
                            {t("common.edit")}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={() => setDeleteTarget(task)}
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
            {t("tasks.showing", {
              visible: paginatedTasks.length,
              total: filteredTasks.length,
            })}
          </p>
          <DataTablePagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </div>
      </section>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-3xl lg:max-w-4xl">
          <DialogHeader className="pr-10">
            <DialogTitle>
              {editingTask ? t("tasks.editDialogTitle") : t("tasks.createDialogTitle")}
            </DialogTitle>
            <DialogDescription>
              {t("tasks.dialogDescription")}
            </DialogDescription>
          </DialogHeader>

          <form className="space-y-5" onSubmit={form.handleSubmit((values) => void onSubmit(values))}>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label={t("tasks.titleLabel")} error={form.formState.errors.title?.message}>
                <Input {...form.register("title")} />
              </Field>

              <Field label={t("tasks.assignee")} error={form.formState.errors.assigneeId?.message}>
                <select
                  className="h-10 w-full rounded-2xl border border-outline-variant bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-ring focus:ring-3 focus:ring-ring/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  {...form.register("assigneeId")}
                >
                  <option value="">{t("tasks.selectEmployee")}</option>
                  {employees.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.fullName}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <Field label={t("tasks.descriptionLabel")} error={form.formState.errors.description?.message}>
              <textarea
                className="min-h-28 w-full rounded-2xl border border-outline-variant bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-ring focus:ring-3 focus:ring-ring/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                {...form.register("description")}
              />
            </Field>

            <div className="grid gap-4 md:grid-cols-3">
              <Field label={t("tasks.priority")} error={form.formState.errors.priority?.message}>
                <select
                  className="h-10 w-full rounded-2xl border border-outline-variant bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-ring focus:ring-3 focus:ring-ring/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  {...form.register("priority")}
                >
                  {priorityOptions.map((priority) => (
                    <option key={priority} value={priority}>
                      {formatTaskPriority(priority, t)}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label={t("users.status")} error={form.formState.errors.status?.message}>
                <select
                  className="h-10 w-full rounded-2xl border border-outline-variant bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-ring focus:ring-3 focus:ring-ring/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  {...form.register("status")}
                >
                  {statusOptions.map((status) => (
                    <option key={status} value={status}>
                      {formatUserStatus(status, t)}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label={t("tasks.dueDate")} error={form.formState.errors.dueDate?.message}>
                <Input type="date" {...form.register("dueDate")} />
              </Field>
            </div>

            <Field label={t("tasks.attachments")}>
              <input
                type="file"
                multiple
                className="block w-full text-sm text-on-surface-variant"
                onChange={(event) => void onFilesSelected(event.target.files)}
              />
              {pendingFiles.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {pendingFiles.map((file) => (
                    <span
                      key={`${file.name}-${file.size}`}
                      className="rounded-full bg-surface-container px-3 py-1 text-xs font-medium text-on-surface"
                    >
                      {file.name}
                    </span>
                  ))}
                </div>
              ) : null}
            </Field>

            {editingTask?.attachments.length ? (
              <div>
                <p className="mb-3 text-sm font-medium text-on-surface">{t("tasks.existingAttachments")}</p>
                <div className="space-y-2">
                  {editingTask.attachments.map((attachment) => (
                    <div
                      key={attachment.id}
                      className="flex flex-col gap-3 rounded-2xl border border-outline-variant px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <a
                        href={attachment.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 text-sm text-on-surface"
                      >
                        <PaperclipIcon className="size-4 text-secondary" />
                        <span className="break-all">{attachment.originalName}</span>
                      </a>
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={() => void onDeleteAttachment(editingTask.id, attachment.id)}
                      >
                        {t("tasks.remove")}
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" size="lg" className="h-11 rounded-2xl px-6" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting
                  ? t("common.saving")
                  : editingTask
                    ? t("tasks.saveTask")
                    : t("tasks.createTask")}
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
        title={t("tasks.deleteTitle")}
        description={deleteTarget ? t("tasks.deleteDescription", { name: deleteTarget.title }) : ""}
        confirmLabel={t("tasks.deleteConfirm")}
        isLoading={isDeleting}
        onConfirm={confirmDeleteTask}
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
