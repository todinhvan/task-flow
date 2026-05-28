import {
  DndContext,
  DragOverlay,
  type DragStartEvent,
  type DragEndEvent,
  useDraggable,
  useDroppable,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  CalendarIcon,
  GripVerticalIcon,
  PaperclipIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
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
import { useEmployeeBoard } from "@/context/EmployeeBoardContext";
import { useI18n } from "@/context/I18nContext";
import { useRealtime } from "@/context/RealtimeContext";
import { api, unwrapEnvelope } from "@/lib/api";
import { formatTaskPriority, formatUserStatus } from "@/lib/display";
import {
  resizeImageFile,
  validateAttachmentFiles,
  validateImageFile,
} from "@/lib/files";
import type {
  BoardList,
  Task,
  TaskPriority,
  TaskStatus,
} from "@/types/api";

const taskSchema = z.object({
  title: z.string().min(2, "Title must be at least 2 characters"),
  description: z.string().optional(),
  listId: z.string().min(1, "Select a list"),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]),
  dueDate: z.string().optional(),
});

const listSchema = z.object({
  name: z.string().min(2, "List name must be at least 2 characters"),
  color: z.string().optional(),
  description: z.string().optional(),
});

type TaskFormValues = z.infer<typeof taskSchema>;
type ListFormValues = z.infer<typeof listSchema>;

const statusOptions: TaskStatus[] = ["TODO", "IN_PROGRESS", "BLOCKED", "DONE"];
const priorityOptions: TaskPriority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];

type DeleteTarget =
  | { kind: "task"; task: Task }
  | { kind: "list"; list: BoardList };

export default function BoardPage() {
  const { t } = useI18n();
  const { assignedPanelOpen, searchQuery } = useEmployeeBoard();
  const { lastEvent } = useRealtime();
  const [lists, setLists] = useState<BoardList[]>([]);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [editingList, setEditingList] = useState<BoardList | null>(null);
  const [detailTask, setDetailTask] = useState<Task | null>(null);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [listDialogOpen, setListDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [movingTaskId, setMovingTaskId] = useState<string | null>(null);
  const [statusUpdatingTaskId, setStatusUpdatingTaskId] = useState<string | null>(null);
  const [dismissingTaskId, setDismissingTaskId] = useState<string | null>(null);
  const [priorityUpdatingTaskId, setPriorityUpdatingTaskId] = useState<string | null>(null);
  const [priorityEditorTaskId, setPriorityEditorTaskId] = useState<string | null>(null);
  const [activeDragTaskId, setActiveDragTaskId] = useState<string | null>(null);

  const taskForm = useForm<TaskFormValues>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      title: "",
      description: "",
      listId: "",
      priority: "MEDIUM",
      dueDate: "",
    },
  });

  const listForm = useForm<ListFormValues>({
    resolver: zodResolver(listSchema),
    defaultValues: {
      name: "",
      color: getDefaultListColor(),
      description: "",
    },
  });

  function syncSelections(nextLists: BoardList[]) {
    if (editingTask) {
      setEditingTask(
        nextLists.flatMap((list) => list.tasks).find((task) => task.id === editingTask.id) ?? null,
      );
    }

    if (editingList) {
      setEditingList(nextLists.find((list) => list.id === editingList.id) ?? null);
    }

    if (detailTask) {
      setDetailTask(
        nextLists.flatMap((list) => list.tasks).find((task) => task.id === detailTask.id) ?? null,
      );
    }
  }

  function applyLists(nextLists: BoardList[]) {
    setLists(nextLists);
    syncSelections(nextLists);
  }

  async function loadBoard(options?: { showPageLoader?: boolean }) {
    const showPageLoader = options?.showPageLoader ?? false;

    try {
      if (showPageLoader) {
        setIsBootstrapping(true);
      }

      setError(null);
      const response = await api.get("/lists");
      applyLists(unwrapEnvelope<BoardList[]>(response.data));
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : t("board.loading"),
      );
    } finally {
      if (showPageLoader) {
        setIsBootstrapping(false);
      }
    }
  }

  useEffect(() => {
    void loadBoard({ showPageLoader: true });
  }, [t]);

  useEffect(() => {
    if (!lastEvent) {
      return;
    }

    void loadBoard();
  }, [lastEvent]);

  const personalLists = useMemo(
    () => lists.filter((list) => !list.isFixed),
    [lists],
  );

  const filteredLists = useMemo(
    () =>
      lists.map((list) => ({
        ...list,
        tasks: list.tasks.filter((task) =>
          `${task.title} ${task.description ?? ""}`
            .toLowerCase()
            .includes(searchQuery.toLowerCase()),
        ),
      })),
    [lists, searchQuery],
  );

  const visiblePersonalLists = useMemo(
    () => filteredLists.filter((list) => !list.isFixed),
    [filteredLists],
  );

  const assignedLists = useMemo(
    () => filteredLists.filter((list) => list.isFixed),
    [filteredLists],
  );

  const activeDraggedTask = useMemo(
    () =>
      activeDragTaskId
        ? lists.flatMap((list) => list.tasks).find((task) => task.id === activeDragTaskId) ?? null
        : null,
    [activeDragTaskId, lists],
  );

  function openCreateTask(listId?: string) {
    setEditingTask(null);
    setPendingFiles([]);
    taskForm.reset({
      title: "",
      description: "",
      listId: listId ?? personalLists[0]?.id ?? "",
      priority: "MEDIUM",
      dueDate: "",
    });
    setTaskDialogOpen(true);
  }

  function openTaskDialog(task: Task) {
    setEditingTask(task);
    setPendingFiles([]);
    taskForm.reset({
      title: task.title,
      description: task.description ?? "",
      listId: task.listId,
      priority: task.priority,
      dueDate: task.dueDate ? task.dueDate.slice(0, 10) : "",
    });
    setTaskDialogOpen(true);
  }

  function openTaskDetail(task: Task) {
    setDetailTask(task);
    setDetailDialogOpen(true);
  }

  function openListDialog(list?: BoardList) {
    setEditingList(list ?? null);
    listForm.reset({
      name: list?.name ?? "",
      color: list?.color ?? getDefaultListColor(),
      description: list?.description ?? "",
    });
    setListDialogOpen(true);
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
      setError(null);
    } catch (fileError) {
      setError(fileError instanceof Error ? fileError.message : "Invalid file");
    }
  }

  async function saveTask(values: TaskFormValues) {
    try {
      setError(null);

      if (editingTask && editingTask.source === "SELF_CREATED") {
        await api.patch(`/tasks/${editingTask.id}`, values);

        if (pendingFiles.length > 0) {
          const attachmentForm = new FormData();
          pendingFiles.forEach((file) => attachmentForm.append("attachments", file));
          await api.post(`/tasks/${editingTask.id}/attachments`, attachmentForm, {
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
        formData.append("source", "SELF_CREATED");
        pendingFiles.forEach((file) => formData.append("attachments", file));
        await api.post("/tasks", formData, {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        });
      }

      setTaskDialogOpen(false);
      setEditingTask(null);
      setPendingFiles([]);
      await loadBoard();
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : t("tasks.saveTask"),
      );
    }
  }

  async function saveList(values: ListFormValues) {
    try {
      setError(null);

      if (editingList) {
        await api.patch(`/lists/${editingList.id}`, values);
      } else {
        await api.post("/lists", values);
      }

      setListDialogOpen(false);
      setEditingList(null);
      await loadBoard();
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : t("board.saveList"),
      );
    }
  }

  async function updateAssignedTaskStatus(taskId: string, status: TaskStatus) {
    const snapshot = lists;
    const currentTask = snapshot.flatMap((list) => list.tasks).find((task) => task.id === taskId);
    if (!currentTask) {
      return;
    }

    const optimisticTask: Task = {
      ...currentTask,
      status,
      completedAt: status === "DONE" ? new Date().toISOString() : null,
    };

    try {
      setError(null);
      setStatusUpdatingTaskId(taskId);
      applyLists(upsertTask(snapshot, optimisticTask));

      const response = await api.patch(`/tasks/${taskId}/status`, { status });
      const updatedTask = unwrapEnvelope<Task>(response.data);
      applyLists(upsertTask(snapshotTaskLists(lists, taskId), updatedTask));
    } catch (statusError) {
      applyLists(snapshot);
      setError(
        statusError instanceof Error
          ? statusError.message
          : t("users.status"),
      );
    } finally {
      setStatusUpdatingTaskId(null);
    }
  }

  async function dismissAssignedTask(taskId: string) {
    const snapshot = lists;
    const task = snapshot.flatMap((list) => list.tasks).find((item) => item.id === taskId);
    if (!task) {
      return;
    }

    try {
      setError(null);
      setDismissingTaskId(taskId);
      applyLists(snapshotTaskLists(snapshot, taskId));
      await api.patch(`/tasks/${taskId}/dismiss`);

      if (editingTask?.id === taskId) {
        setTaskDialogOpen(false);
        setEditingTask(null);
      }
      if (detailTask?.id === taskId) {
        setDetailDialogOpen(false);
        setDetailTask(null);
      }
    } catch (dismissError) {
      applyLists(snapshot);
      setError(
        dismissError instanceof Error ? dismissError.message : t("common.saveChanges"),
      );
    } finally {
      setDismissingTaskId(null);
    }
  }

  async function deleteAttachment(taskId: string, attachmentId: string) {
    const snapshot = lists;
    const nextLists = updateTaskLocally(snapshot, taskId, (task) => ({
      ...task,
      attachments: task.attachments.filter((attachment) => attachment.id !== attachmentId),
    }));

    try {
      setError(null);
      applyLists(nextLists);
      await api.delete(`/tasks/${taskId}/attachments/${attachmentId}`);
    } catch (attachmentError) {
      applyLists(snapshot);
      setError(
        attachmentError instanceof Error
          ? attachmentError.message
          : t("tasks.remove"),
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

      if (deleteTarget.kind === "task") {
        await api.delete(`/tasks/${deleteTarget.task.id}`);
        if (editingTask?.id === deleteTarget.task.id) {
          setTaskDialogOpen(false);
          setEditingTask(null);
        }
      } else {
        await api.delete(`/lists/${deleteTarget.list.id}`);
        if (editingList?.id === deleteTarget.list.id) {
          setListDialogOpen(false);
          setEditingList(null);
        }
      }

      setDeleteTarget(null);
      await loadBoard();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : t("common.delete"),
      );
    } finally {
      setIsDeleting(false);
    }
  }

  async function updateTaskPriority(taskId: string, priority: TaskPriority) {
    const snapshot = lists;
    const currentTask = snapshot.flatMap((list) => list.tasks).find((task) => task.id === taskId);
    if (!currentTask || currentTask.source !== "SELF_CREATED" || currentTask.priority === priority) {
      setPriorityEditorTaskId(null);
      return;
    }

    try {
      setError(null);
      setPriorityUpdatingTaskId(taskId);
      applyLists(
        updateTaskLocally(snapshot, taskId, (task) => ({
          ...task,
          priority,
        })),
      );
      await api.patch(`/tasks/${taskId}`, { priority });
      setPriorityEditorTaskId(null);
      await loadBoard();
    } catch (priorityError) {
      applyLists(snapshot);
      setError(
        priorityError instanceof Error ? priorityError.message : t("tasks.priority"),
      );
    } finally {
      setPriorityUpdatingTaskId(null);
    }
  }

  async function onDragEnd(event: DragEndEvent) {
    const taskId = String(event.active.id);
    const targetListId = event.over ? String(event.over.id) : null;

    setActiveDragTaskId(null);

    if (!targetListId) {
      return;
    }

    const sourceTask = lists.flatMap((list) => list.tasks).find((task) => task.id === taskId);
    const targetList = lists.find((list) => list.id === targetListId);

    if (!sourceTask || !targetList || sourceTask.source !== "SELF_CREATED" || sourceTask.listId === targetListId) {
      return;
    }

    const snapshot = lists;
    const optimisticTask: Task = {
      ...sourceTask,
      listId: targetList.id,
      list: {
        id: targetList.id,
        name: targetList.name,
        slug: targetList.slug,
      },
      status: statusForListSlug(targetList.slug),
    };

    try {
      setError(null);
      setMovingTaskId(taskId);
      applyLists(moveTaskAcrossLists(snapshot, optimisticTask));

      await api.patch(`/tasks/${taskId}/move`, { listId: targetListId });
      await loadBoard();
    } catch (moveError) {
      applyLists(snapshot);
      setError(
        moveError instanceof Error ? moveError.message : t("tasks.title"),
      );
    } finally {
      setMovingTaskId(null);
    }
  }

  function onDragStart(event: DragStartEvent) {
    const taskId = String(event.active.id);
    const task = lists.flatMap((list) => list.tasks).find((item) => item.id === taskId);
    if (!task || task.source !== "SELF_CREATED") {
      return;
    }

    setActiveDragTaskId(task.id);
  }

  if (isBootstrapping) {
    return <div className="p-6 text-sm text-on-surface-variant">{t("board.loading")}</div>;
  }

  return (
    <>
      <div
        className="relative h-full overflow-hidden bg-surface-bright text-on-surface"
        style={
          {
            "--assigned-panel-width": "min(22rem, calc(100vw - 2.5rem))",
          } as React.CSSProperties
        }
      >
        {error ? (
          <div className="absolute left-4 right-4 top-4 z-30 rounded-2xl border border-error/20 bg-error/10 px-4 py-3 text-sm text-error shadow-lg md:left-6 md:right-auto md:min-w-96">
            {error}
          </div>
        ) : null}

        <div className="relative flex h-full min-h-0">
          <aside
            className={[
              "relative z-10 shrink-0 transition-[width] duration-300 ease-out",
              assignedPanelOpen ? "w-[var(--assigned-panel-width)]" : "w-0",
            ].join(" ")}
          >
            <div
              className={[
                "flex h-full w-[var(--assigned-panel-width)] flex-col border-r border-outline-variant/70 bg-surface-container-low/95 px-4 pb-5 pt-4 shadow-[24px_0_42px_color-mix(in_oklch,var(--background),transparent_74%)] backdrop-blur-xl transition-transform duration-300 ease-out",
                assignedPanelOpen ? "translate-x-0" : "-translate-x-full",
              ].join(" ")}
            >
              <div className="flex-1 overflow-y-auto pr-1">
                {assignedLists.some((list) => list.tasks.length > 0) ? (
                  <div className="space-y-4">
                    {assignedLists.map((list) => (
                      <AssignedTaskLane
                        key={list.id}
                        list={list}
                        dismissingTaskId={dismissingTaskId}
                        statusUpdatingTaskId={statusUpdatingTaskId}
                        onDismissTask={dismissAssignedTask}
                        onEditTask={openTaskDetail}
                        onUpdateAssignedStatus={updateAssignedTaskStatus}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="rounded-[28px] border border-dashed border-outline-variant bg-surface px-4 py-6 text-sm text-on-surface-variant">
                    {t("board.noAssignedTasks")}
                  </div>
                )}
              </div>
            </div>
          </aside>

          <div className="min-w-0 flex-1 overflow-hidden">
            <DndContext
              onDragStart={onDragStart}
              onDragEnd={(event) => void onDragEnd(event)}
              onDragCancel={() => setActiveDragTaskId(null)}
            >
              <div className="flex h-full min-w-0 gap-5 overflow-x-auto overflow-y-hidden px-4 pb-6 pt-4 md:px-6">
                {visiblePersonalLists.map((list) => (
                  <BoardColumn
                    key={list.id}
                    list={list}
                    activeDragTaskId={activeDragTaskId}
                    movingTaskId={movingTaskId}
                    priorityEditorTaskId={priorityEditorTaskId}
                    priorityUpdatingTaskId={priorityUpdatingTaskId}
                    statusUpdatingTaskId={statusUpdatingTaskId}
                    onAddTask={openCreateTask}
                    onEditList={openListDialog}
                    onDeleteList={(target) => setDeleteTarget({ kind: "list", list: target })}
                    onEditTask={openTaskDialog}
                    onDeleteTask={(task) => setDeleteTarget({ kind: "task", task })}
                    onOpenTaskDetail={openTaskDetail}
                    onSetPriorityEditorTaskId={setPriorityEditorTaskId}
                    onUpdateTaskPriority={updateTaskPriority}
                    onUpdateAssignedStatus={updateAssignedTaskStatus}
                  />
                ))}

                <button
                  type="button"
                  onClick={() => openListDialog()}
                  className="flex h-fit w-[300px] shrink-0 items-center gap-3 rounded-[24px] border border-dashed border-outline-variant bg-white px-5 py-4 text-left text-slate-900 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
                >
                  <span className="inline-flex size-9 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800">
                    <PlusIcon className="size-4" />
                  </span>
                  <div className="font-semibold">Add List</div>
                </button>

                {visiblePersonalLists.length === 0 ? (
                  <div className="flex w-[320px] shrink-0 items-center rounded-[28px] border border-dashed border-outline-variant bg-surface px-5 py-6 text-sm text-on-surface-variant">
                    {t("board.noPersonalLists")}
                  </div>
                ) : null}
              </div>
              <DragOverlay zIndex={9999}>
                {activeDraggedTask ? <TaskDragOverlayCard task={activeDraggedTask} /> : null}
              </DragOverlay>
            </DndContext>
          </div>
        </div>
      </div>

      <Dialog
        open={detailDialogOpen}
        onOpenChange={(open) => {
          setDetailDialogOpen(open);
          if (!open) {
            setDetailTask(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-xl lg:max-w-2xl">
          {detailTask ? (
            <>
              <DialogHeader className="pr-10">
                <DialogTitle>{detailTask.title}</DialogTitle>
                <DialogDescription>{t("tasks.detailAction")}</DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="rounded-2xl border border-outline-variant bg-surface px-4 py-4 text-sm text-on-surface-variant">
                  {detailTask.description || t("tasks.noDescription")}
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <Badge className="border-slate-200 bg-slate-100 text-slate-800 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-800">
                    {formatTaskPriority(detailTask.priority, t)}
                  </Badge>
                  <Badge className="border-slate-200 bg-slate-100 text-slate-800 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-800">
                    {formatUserStatus(detailTask.status, t)}
                  </Badge>
                  <span className="inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                    <CalendarIcon className="size-4" />
                    {detailTask.dueDate ? detailTask.dueDate.slice(0, 10) : t("dashboard.noDueDate")}
                  </span>
                </div>

                {detailTask.source === "MANAGER_ASSIGNED" ? (
                  <div className="space-y-3 border-t border-outline-variant/50 pt-4">
                    <Field label={t("users.status")}>
                      <select
                        className="h-10 w-full rounded-2xl border border-outline-variant bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-ring focus:ring-3 focus:ring-ring/30 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                        value={detailTask.status}
                        disabled={statusUpdatingTaskId === detailTask.id || dismissingTaskId === detailTask.id}
                        onChange={(event) =>
                          void updateAssignedTaskStatus(detailTask.id, event.target.value as TaskStatus)
                        }
                      >
                        {statusOptions.map((status) => (
                          <option key={status} value={status}>
                            {formatUserStatus(status, t)}
                          </option>
                        ))}
                      </select>
                    </Field>

                    {detailTask.status === "DONE" ? (
                      <Button
                        type="button"
                        className="h-10 rounded-2xl"
                        disabled={dismissingTaskId === detailTask.id}
                        onClick={() => void dismissAssignedTask(detailTask.id)}
                      >
                        {dismissingTaskId === detailTask.id
                          ? t("common.saving")
                          : t("board.dismissAssignedTask")}
                      </Button>
                    ) : null}
                  </div>
                ) : null}

                {detailTask.attachments.length > 0 ? (
                  <div className="space-y-2 border-t border-outline-variant/50 pt-4">
                    {detailTask.attachments.map((attachment) => (
                      <a
                        key={attachment.id}
                        href={attachment.url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-3 rounded-2xl border border-outline-variant bg-surface px-4 py-3 text-sm text-on-surface transition hover:border-primary"
                      >
                        <PaperclipIcon className="size-4 text-secondary" />
                        {attachment.originalName}
                      </a>
                    ))}
                  </div>
                ) : null}

                <div className="flex flex-wrap justify-end gap-3">
                  {detailTask.source === "SELF_CREATED" ? (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setDetailDialogOpen(false);
                        openTaskDialog(detailTask);
                      }}
                    >
                      <PencilIcon />
                      {t("tasks.editDialogTitle")}
                    </Button>
                  ) : null}
                  <Button type="button" onClick={() => setDetailDialogOpen(false)}>
                    {t("common.close")}
                  </Button>
                </div>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={taskDialogOpen} onOpenChange={setTaskDialogOpen}>
        <DialogContent className="sm:max-w-2xl lg:max-w-3xl">
          <DialogHeader className="pr-10">
            <DialogTitle>
              {editingTask
                ? editingTask.source === "MANAGER_ASSIGNED"
                  ? editingTask.title
                  : t("tasks.editDialogTitle")
                : t("tasks.createDialogTitle")}
            </DialogTitle>
            <DialogDescription>
              {editingTask?.source === "MANAGER_ASSIGNED"
                ? t("board.taskDialogAssignedDescription")
                : t("board.taskDialogPersonalDescription")}
            </DialogDescription>
          </DialogHeader>

          {editingTask?.source === "MANAGER_ASSIGNED" ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-outline-variant bg-surface px-4 py-4 text-sm text-on-surface-variant">
                {editingTask.description || t("tasks.noDescription")}
              </div>

              <Field label={t("users.status")}>
                <select
                  className="h-10 w-full rounded-2xl border border-outline-variant bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-ring focus:ring-3 focus:ring-ring/30 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  value={editingTask.status}
                  disabled={statusUpdatingTaskId === editingTask.id || dismissingTaskId === editingTask.id}
                  onChange={(event) =>
                    void updateAssignedTaskStatus(editingTask.id, event.target.value as TaskStatus)
                  }
                >
                  {statusOptions.map((status) => (
                    <option key={status} value={status}>
                      {formatUserStatus(status, t)}
                    </option>
                  ))}
                </select>
              </Field>

              {editingTask.status === "DONE" ? (
                <Button
                  type="button"
                  size="lg"
                  className="h-11 rounded-2xl px-6"
                  disabled={dismissingTaskId === editingTask.id}
                  onClick={() => void dismissAssignedTask(editingTask.id)}
                >
                  {dismissingTaskId === editingTask.id
                    ? t("common.saving")
                    : t("board.dismissAssignedTask")}
                </Button>
              ) : null}

              {editingTask.attachments.length > 0 ? (
                <div className="space-y-2">
                  {editingTask.attachments.map((attachment) => (
                    <a
                      key={attachment.id}
                      href={attachment.url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-3 rounded-2xl border border-outline-variant bg-surface px-4 py-3 text-sm text-on-surface transition hover:border-primary"
                    >
                      <PaperclipIcon className="size-4 text-secondary" />
                      {attachment.originalName}
                    </a>
                  ))}
                </div>
              ) : null}
            </div>
          ) : (
            <form className="space-y-5" onSubmit={taskForm.handleSubmit((values) => void saveTask(values))}>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label={t("tasks.titleLabel")} error={taskForm.formState.errors.title?.message}>
                  <Input className="h-10 border-outline-variant bg-white text-slate-900 placeholder:text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-400" {...taskForm.register("title")} />
                </Field>
                <Field label={t("board.list")} error={taskForm.formState.errors.listId?.message}>
                  <select
                    className="h-10 w-full rounded-2xl border border-outline-variant bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-ring focus:ring-3 focus:ring-ring/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    {...taskForm.register("listId")}
                  >
                    <option value="">{t("board.selectList")}</option>
                    {personalLists.map((list) => (
                      <option key={list.id} value={list.id}>
                        {list.name}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              <Field label={t("tasks.descriptionLabel")} error={taskForm.formState.errors.description?.message}>
                <textarea
                  className="min-h-28 w-full rounded-2xl border border-outline-variant bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-ring focus:ring-3 focus:ring-ring/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  {...taskForm.register("description")}
                />
              </Field>

              <div className="grid gap-4 md:grid-cols-2">
                <Field label={t("tasks.priority")} error={taskForm.formState.errors.priority?.message}>
                  <select
                    className="h-10 w-full rounded-2xl border border-outline-variant bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-ring focus:ring-3 focus:ring-ring/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    {...taskForm.register("priority")}
                  >
                    {priorityOptions.map((priority) => (
                      <option key={priority} value={priority}>
                        {formatTaskPriority(priority, t)}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label={t("tasks.dueDate")} error={taskForm.formState.errors.dueDate?.message}>
                  <Input className="h-10 border-outline-variant bg-white text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" type="date" {...taskForm.register("dueDate")} />
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
                <div className="space-y-2">
                  {editingTask.attachments.map((attachment) => (
                    <div
                      key={attachment.id}
                      className="flex items-center justify-between rounded-2xl border border-outline-variant px-3 py-2 text-sm"
                    >
                      <a href={attachment.url} target="_blank" rel="noreferrer">
                        {attachment.originalName}
                      </a>
                      <button
                        type="button"
                        className="font-medium text-error"
                        onClick={() => void deleteAttachment(editingTask.id, attachment.id)}
                      >
                        {t("tasks.remove")}
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}

              <div className="flex flex-wrap justify-end gap-3">
                {editingTask ? (
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => setDeleteTarget({ kind: "task", task: editingTask })}
                  >
                    <Trash2Icon />
                    {t("common.delete")}
                  </Button>
                ) : null}
                <Button type="button" variant="outline" onClick={() => setTaskDialogOpen(false)}>
                  {t("common.cancel")}
                </Button>
                <Button
                  type="submit"
                  size="lg"
                  className="h-11 rounded-2xl px-6"
                  disabled={taskForm.formState.isSubmitting}
                >
                  {taskForm.formState.isSubmitting
                    ? t("common.saving")
                    : editingTask
                      ? t("tasks.saveTask")
                      : t("tasks.createTask")}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={listDialogOpen} onOpenChange={setListDialogOpen}>
        <DialogContent className="sm:max-w-xl lg:max-w-2xl">
          <DialogHeader className="pr-10">
            <DialogTitle>{editingList ? t("board.editList") : t("board.createList")}</DialogTitle>
            <DialogDescription>
              {t("board.listDialogDescription")}
            </DialogDescription>
          </DialogHeader>

          <form className="space-y-5" onSubmit={listForm.handleSubmit((values) => void saveList(values))}>
            <Field label={t("board.name")} error={listForm.formState.errors.name?.message}>
              <Input className="h-10 border-outline-variant bg-white text-slate-900 placeholder:text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-400" {...listForm.register("name")} />
            </Field>
            <Field label={t("board.color")} error={listForm.formState.errors.color?.message}>
              <Input className="h-10 border-outline-variant bg-white dark:border-slate-700 dark:bg-slate-900" type="color" {...listForm.register("color")} />
            </Field>
            <Field label={t("tasks.descriptionLabel")} error={listForm.formState.errors.description?.message}>
              <textarea
                className="min-h-24 w-full rounded-2xl border border-outline-variant bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-ring focus:ring-3 focus:ring-ring/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                {...listForm.register("description")}
              />
            </Field>

            <div className="flex flex-wrap justify-end gap-3">
              {editingList ? (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => setDeleteTarget({ kind: "list", list: editingList })}
                >
                  <Trash2Icon />
                  {t("common.delete")}
                </Button>
              ) : null}
              <Button type="button" variant="outline" onClick={() => setListDialogOpen(false)}>
                {t("common.cancel")}
              </Button>
              <Button
                type="submit"
                size="lg"
                className="h-11 rounded-2xl px-6"
                disabled={listForm.formState.isSubmitting}
              >
                {listForm.formState.isSubmitting
                  ? t("common.saving")
                  : editingList
                    ? t("board.saveList")
                    : t("board.createList")}
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
        title={deleteTarget?.kind === "list" ? t("board.deleteListTitle") : t("tasks.deleteTitle")}
        description={
          deleteTarget?.kind === "list"
            ? t("board.deleteListDescription", { name: deleteTarget.list.name })
            : deleteTarget
              ? t("board.deleteTaskDescription", { name: deleteTarget.task.title })
              : ""
        }
        confirmLabel={deleteTarget?.kind === "list" ? t("board.deleteListTitle") : t("tasks.deleteConfirm")}
        isLoading={isDeleting}
        onConfirm={confirmDelete}
      />
    </>
  );
}

function BoardColumn({
  list,
  activeDragTaskId,
  movingTaskId,
  priorityEditorTaskId,
  priorityUpdatingTaskId,
  statusUpdatingTaskId,
  onAddTask,
  onEditList,
  onDeleteList,
  onEditTask,
  onDeleteTask,
  onOpenTaskDetail,
  onSetPriorityEditorTaskId,
  onUpdateTaskPriority,
  onUpdateAssignedStatus,
}: {
  list: BoardList;
  activeDragTaskId: string | null;
  movingTaskId: string | null;
  priorityEditorTaskId: string | null;
  priorityUpdatingTaskId: string | null;
  statusUpdatingTaskId: string | null;
  onAddTask: (listId?: string) => void;
  onEditList: (list?: BoardList) => void;
  onDeleteList: (list: BoardList) => void;
  onEditTask: (task: Task) => void;
  onDeleteTask: (task: Task) => void;
  onOpenTaskDetail: (task: Task) => void;
  onSetPriorityEditorTaskId: (taskId: string | null) => void;
  onUpdateTaskPriority: (taskId: string, priority: TaskPriority) => void;
  onUpdateAssignedStatus: (taskId: string, status: TaskStatus) => void;
}) {
  const { t } = useI18n();
  const { setNodeRef, isOver } = useDroppable({
    id: list.id,
    disabled: false,
  });

  return (
    <div
      ref={setNodeRef}
      className={[
        "flex h-fit max-h-full w-[320px] shrink-0 flex-col rounded-[22px] border bg-white text-slate-900 shadow-[0_18px_28px_color-mix(in_oklch,var(--background),transparent_78%)] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100",
        isOver ? "border-primary ring-2 ring-primary/20" : "border-outline-variant",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-3 px-4 pb-3 pt-4">
        <div>
          <div className="flex items-center gap-3">
            <span className="size-2.5 rounded-full border border-slate-200 dark:border-slate-600" style={{ backgroundColor: list.color ?? "var(--primary)" }} />
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{list.name}</h3>
          </div>
          <p className="mt-2 text-xs uppercase tracking-[0.18em] text-slate-600 dark:text-slate-400">
            {t("board.listTasksCount", { count: list.tasks.length })}
          </p>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                />
            }
          >
            <span className="material-symbols-outlined text-[18px]">more_horiz</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onEditList(list)}>
              <PencilIcon className="size-4" />
              {t("board.editList")}
            </DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onClick={() => onDeleteList(list)}>
              <Trash2Icon className="size-4" />
              {t("board.deleteListTitle")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex flex-1 flex-col gap-3 px-3 pb-4">
        <div className="flex-1 space-y-3 overflow-y-auto pr-1">
          {list.tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              isDragGhost={activeDragTaskId === task.id}
              isMoving={movingTaskId === task.id}
              isPriorityEditing={priorityEditorTaskId === task.id}
              isPriorityUpdating={priorityUpdatingTaskId === task.id}
              isStatusUpdating={statusUpdatingTaskId === task.id}
              onDetail={onOpenTaskDetail}
              onEdit={onEditTask}
              onDelete={onDeleteTask}
              onSetPriorityEditorTaskId={onSetPriorityEditorTaskId}
              onUpdatePriority={onUpdateTaskPriority}
              onUpdateAssignedStatus={onUpdateAssignedStatus}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={() => onAddTask(list.id)}
          className="flex items-center justify-between gap-2 rounded-2xl border border-dashed border-outline-variant bg-white px-3 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
        >
          <span className="inline-flex items-center gap-2">
            <PlusIcon className="size-4" />
            {t("board.addTask")}
          </span>
          <span className="text-lg leading-none">+</span>
        </button>
      </div>
    </div>
  );
}

function AssignedTaskLane({
  list,
  dismissingTaskId,
  statusUpdatingTaskId,
  onDismissTask,
  onEditTask,
  onUpdateAssignedStatus,
}: {
  list: BoardList;
  dismissingTaskId: string | null;
  statusUpdatingTaskId: string | null;
  onDismissTask: (taskId: string) => void;
  onEditTask: (task: Task) => void;
  onUpdateAssignedStatus: (taskId: string, status: TaskStatus) => void;
}) {
  const { t } = useI18n();

  return (
    <section className="rounded-[28px] border border-outline-variant bg-surface px-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="font-medium text-on-surface">{list.name}</div>
          <div className="mt-1 text-xs uppercase tracking-[0.18em] text-on-surface-variant">
            {t("board.listTasksCount", { count: list.tasks.length })}
          </div>
        </div>
        <Badge variant="outline">{t("board.assignedBadge")}</Badge>
      </div>

      <div className="mt-4 space-y-3">
        {list.tasks.map((task) => (
          <div
            key={task.id}
            className="rounded-[24px] border border-outline-variant bg-white p-4 text-slate-900 shadow-[0_10px_18px_color-mix(in_oklch,var(--background),transparent_84%)] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          >
            <button type="button" className="w-full text-left" onClick={() => onEditTask(task)}>
              <div className="font-medium">{task.title}</div>
            </button>

            <div className="mt-3 flex items-center justify-between gap-3 text-xs uppercase tracking-[0.16em] text-slate-600 dark:text-slate-400">
              <span className="inline-flex items-center gap-1">
                <CalendarIcon className="size-3.5" />
                {task.dueDate ? task.dueDate.slice(0, 10) : t("dashboard.noDueDate")}
              </span>
              <Badge className="border-slate-200 bg-slate-100 text-slate-800 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-800">
                {formatTaskPriority(task.priority, t)}
              </Badge>
            </div>

            <div className="mt-4 space-y-3 border-t border-outline-variant/50 pt-4">
              <select
                className="h-10 w-full rounded-2xl border border-outline-variant bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-ring focus:ring-3 focus:ring-ring/30 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                value={task.status}
                disabled={statusUpdatingTaskId === task.id || dismissingTaskId === task.id}
                onChange={(event) =>
                  void onUpdateAssignedStatus(task.id, event.target.value as TaskStatus)
                }
              >
                {statusOptions.map((status) => (
                  <option key={status} value={status}>
                    {formatUserStatus(status, t)}
                  </option>
                ))}
              </select>

              {task.status === "DONE" ? (
                <Button
                  type="button"
                  className="h-10 w-full rounded-2xl"
                  disabled={dismissingTaskId === task.id}
                  onClick={() => void onDismissTask(task.id)}
                >
                  {dismissingTaskId === task.id
                    ? t("common.saving")
                    : t("board.dismissAssignedTask")}
                </Button>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}


function TaskCard({
  task,
  isDragGhost,
  isMoving,
  isPriorityEditing,
  isPriorityUpdating,
  isStatusUpdating,
  onDetail,
  onEdit,
  onDelete,
  onSetPriorityEditorTaskId,
  onUpdatePriority,
  onUpdateAssignedStatus,
}: {
  task: Task;
  isDragGhost: boolean;
  isMoving: boolean;
  isPriorityEditing: boolean;
  isPriorityUpdating: boolean;
  isStatusUpdating: boolean;
  onDetail: (task: Task) => void;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
  onSetPriorityEditorTaskId: (taskId: string | null) => void;
  onUpdatePriority: (taskId: string, priority: TaskPriority) => void;
  onUpdateAssignedStatus: (taskId: string, status: TaskStatus) => void;
}) {
  const { t } = useI18n();
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
    disabled: task.source !== "SELF_CREATED" || isMoving,
  });
  const shouldHideSourceCard = isDragGhost || isDragging;

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: shouldHideSourceCard ? undefined : CSS.Translate.toString(transform),
        zIndex: isDragging ? 9999 : undefined,
        visibility: shouldHideSourceCard ? "hidden" : undefined,
        boxShadow: shouldHideSourceCard ? "none" : undefined,
      }}
      className={[
        "relative rounded-[18px] border border-outline-variant bg-white p-3 text-slate-900 shadow-[0_12px_18px_color-mix(in_oklch,var(--background),transparent_84%)] transition-colors dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100",
        shouldHideSourceCard ? "pointer-events-none border-transparent bg-transparent shadow-none ring-0" : "",
        !shouldHideSourceCard && (isDragging || isMoving)
          ? "z-[9999] scale-[0.98] opacity-85 shadow-2xl ring-2 ring-primary/20"
          : "hover:bg-slate-50 dark:hover:bg-slate-800",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          {task.source === "SELF_CREATED" ? (
            <button
              type="button"
              className="mt-0.5 rounded-full p-1 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 disabled:opacity-40 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
              disabled={isMoving}
              {...attributes}
              {...listeners}
            >
              <GripVerticalIcon className="size-4" />
            </button>
          ) : null}
          <button type="button" className="min-w-0 text-left" onClick={() => onDetail(task)}>
            <div className="font-medium text-slate-900 dark:text-slate-100">{task.title}</div>
          </button>
        </div>

        {task.source === "SELF_CREATED" ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  className="rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                />
              }
            >
              <span className="material-symbols-outlined text-[18px]">more_horiz</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onDetail(task)}>
                <span className="material-symbols-outlined text-[18px]">article</span>
                {t("tasks.detailAction")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onEdit(task)}>
                <PencilIcon className="size-4" />
                {t("tasks.editDialogTitle")}
              </DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onClick={() => onDelete(task)}>
                <Trash2Icon className="size-4" />
                {t("tasks.deleteTitle")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Badge className="border-slate-200 bg-slate-100 text-slate-800 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-800">
            {isStatusUpdating ? t("common.saving") : t("board.assignedBadge")}
          </Badge>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 text-xs uppercase tracking-[0.16em] text-slate-600 dark:text-slate-400">
        <span className="inline-flex items-center gap-1">
          <CalendarIcon className="size-3.5" />
          {task.dueDate ? task.dueDate.slice(0, 10) : t("dashboard.noDueDate")}
        </span>
        {task.source === "SELF_CREATED" ? (
          isPriorityEditing ? (
            <select
              autoFocus
              className="h-8 rounded-xl border border-outline-variant bg-white px-2 text-xs font-medium text-slate-900 outline-none transition focus:border-ring focus:ring-3 focus:ring-ring/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              value={task.priority}
              disabled={isPriorityUpdating}
              onBlur={() => onSetPriorityEditorTaskId(null)}
              onChange={(event) =>
                void onUpdatePriority(task.id, event.target.value as TaskPriority)
              }
            >
              {priorityOptions.map((priority) => (
                <option key={priority} value={priority}>
                  {formatTaskPriority(priority, t)}
                </option>
              ))}
            </select>
          ) : (
            <button
              type="button"
              className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-medium normal-case tracking-normal text-slate-800 transition hover:bg-slate-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              disabled={isPriorityUpdating}
              onClick={() => onSetPriorityEditorTaskId(task.id)}
            >
              {isPriorityUpdating ? t("common.saving") : formatTaskPriority(task.priority, t)}
            </button>
          )
        ) : (
          <Badge className="border-slate-200 bg-slate-100 text-slate-800 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-800">
            {formatTaskPriority(task.priority, t)}
          </Badge>
        )}
      </div>

      {task.source === "MANAGER_ASSIGNED" ? (
        <div className="mt-4 space-y-3 border-t border-outline-variant/50 pt-4">
          <select
            className="h-10 w-full rounded-2xl border border-outline-variant bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-ring focus:ring-3 focus:ring-ring/30 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            value={task.status}
            disabled={isStatusUpdating}
            onChange={(event) =>
              void onUpdateAssignedStatus(task.id, event.target.value as TaskStatus)
            }
          >
            {statusOptions.map((status) => (
              <option key={status} value={status}>
                {formatUserStatus(status, t)}
              </option>
            ))}
          </select>
        </div>
      ) : null}
    </div>
  );
}

function TaskDragOverlayCard({ task }: { task: Task }) {
  const { t } = useI18n();

  return (
    <div className="w-[288px] rounded-[18px] border border-outline-variant bg-white p-3 text-slate-900 shadow-2xl ring-2 ring-primary/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <span className="mt-0.5 rounded-full p-1 text-slate-500 dark:text-slate-400">
            <GripVerticalIcon className="size-4" />
          </span>
          <div className="min-w-0 text-left">
            <div className="font-medium text-slate-900 dark:text-slate-100">{task.title}</div>
          </div>
        </div>
        <span className="material-symbols-outlined text-[18px] text-slate-500 dark:text-slate-400">
          more_horiz
        </span>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 text-xs uppercase tracking-[0.16em] text-slate-600 dark:text-slate-400">
        <span className="inline-flex items-center gap-1">
          <CalendarIcon className="size-3.5" />
          {task.dueDate ? task.dueDate.slice(0, 10) : t("dashboard.noDueDate")}
        </span>
        <Badge className="border-slate-200 bg-slate-100 text-slate-800 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-800">
          {formatTaskPriority(task.priority, t)}
        </Badge>
      </div>
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

function getDefaultListColor() {
  if (typeof window === "undefined") {
    return "#00b4d8";
  }

  const primary = window.getComputedStyle(document.documentElement)
    .getPropertyValue("--primary")
    .trim();

  return normalizeCssColorToHex(primary) ?? "#00b4d8";
}

function normalizeCssColorToHex(value: string) {
  if (!value) {
    return null;
  }

  if (value.startsWith("#")) {
    return value;
  }

  const match = value.match(/\d+/g);
  if (!match || match.length < 3) {
    return null;
  }

  const [red, green, blue] = match.slice(0, 3).map((part) =>
    Math.max(0, Math.min(255, Number(part))),
  );

  return `#${[red, green, blue]
    .map((channel) => channel.toString(16).padStart(2, "0"))
    .join("")}`;
}

function statusForListSlug(slug: string): TaskStatus {
  if (slug === "in-progress") {
    return "IN_PROGRESS";
  }

  if (slug === "done") {
    return "DONE";
  }

  return "TODO";
}

function snapshotTaskLists(lists: BoardList[], taskId: string) {
  return lists.map((list) => ({
    ...list,
    tasks: list.tasks.filter((task) => task.id !== taskId),
  }));
}

function updateTaskLocally(
  lists: BoardList[],
  taskId: string,
  updater: (task: Task) => Task,
) {
  return lists.map((list) => ({
    ...list,
    tasks: list.tasks.map((task) => (task.id === taskId ? updater(task) : task)),
  }));
}

function upsertTask(lists: BoardList[], nextTask: Task) {
  const withoutTask = snapshotTaskLists(lists, nextTask.id);

  return withoutTask.map((list) => {
    if (list.id !== nextTask.listId) {
      return list;
    }

    const nextTasks = [...list.tasks, nextTask].sort((left, right) => left.position - right.position);
    return {
      ...list,
      tasks: nextTasks,
    };
  });
}

function moveTaskAcrossLists(lists: BoardList[], movedTask: Task) {
  const withoutTask = snapshotTaskLists(lists, movedTask.id);

  return withoutTask.map((list) => {
    if (list.id !== movedTask.listId) {
      return list;
    }

    return {
      ...list,
      tasks: [...list.tasks, { ...movedTask, position: list.tasks.length }],
    };
  });
}
