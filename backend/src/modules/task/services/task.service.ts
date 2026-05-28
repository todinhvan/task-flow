import { AttachmentKind, RoleCode, TaskSource, TaskStatus } from '@/generated/prisma/enums';
import { RealtimeService } from '@/modules/realtime/services/realtime.service';
import { RealtimeTaskSnapshot } from '@/modules/realtime/types/realtime-event.type';
import { ResponseApi } from '@/shared/interfaces/common/response.interface';
import { CloudinaryProvider } from '@/shared/providers/cloudinary.provider';
import { PrismaProvider } from '@/shared/providers/prisma.provider';
import { WorkspaceProvisionProvider } from '@/shared/providers/workspace-provision.provider';
import { getAttachmentKind } from '@/shared/utils/file.util';
import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { UploadFolder } from '@/shared/constants/upload.constant';
import {
  CreateTaskRequest,
  ListTasksQuery,
  MoveTaskRequest,
  UpdateTaskRequest,
  UpdateTaskStatusRequest,
} from '../dto/task.dto';

type SessionUser = {
  userId: string;
  roleCode: string;
};

@Injectable()
export class TaskService {
  constructor(
    private readonly prisma: PrismaProvider,
    private readonly cloudinaryProvider: CloudinaryProvider,
    private readonly workspaceProvisionProvider: WorkspaceProvisionProvider,
    private readonly realtimeService: RealtimeService,
  ) {}

  async listTasks(query: ListTasksQuery, currentUser: SessionUser) {
    const where =
      currentUser.roleCode === RoleCode.ADMIN
        ? {
            deletedAt: null,
            source: TaskSource.MANAGER_ASSIGNED,
          }
        : currentUser.roleCode === RoleCode.MANAGER
          ? {
              deletedAt: null,
              source: TaskSource.MANAGER_ASSIGNED,
              assignedById: currentUser.userId,
            }
          : {
              deletedAt: null,
              assigneeId: currentUser.userId,
              assigneeDismissedAt: null,
              source: query.source ?? undefined,
            };

    const tasks = await this.prisma.task.findMany({
      where: {
        ...where,
        ...(query.assigneeId && currentUser.roleCode !== RoleCode.EMPLOYEE ? { assigneeId: query.assigneeId } : {}),
        ...(query.status ? { status: query.status } : {}),
        ...(query.search
          ? {
              OR: [
                { title: { contains: query.search, mode: 'insensitive' } },
                { description: { contains: query.search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: {
        attachments: true,
        list: true,
        assignee: {
          include: {
            profile: true,
            role: true,
          },
        },
        creator: {
          include: {
            profile: true,
          },
        },
        assignedBy: {
          include: {
            profile: true,
          },
        },
      },
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
    });

    return ResponseApi.success({
      data: tasks.map((task) => this.mapTask(task)),
    });
  }

  async getTaskById(taskId: string, currentUser: SessionUser) {
    const task = await this.findTask(taskId);
    this.ensureTaskAccess(task, currentUser, 'view');

    return ResponseApi.success({
      data: this.mapTask(task),
    });
  }

  async createTask(payload: CreateTaskRequest, attachments: Express.Multer.File[], currentUser: SessionUser) {
    const source = this.resolveTaskSource(payload, currentUser);

    if (source === TaskSource.MANAGER_ASSIGNED) {
      return this.createAssignedTask(payload, attachments, currentUser);
    }

    return this.createSelfTask(payload, attachments, currentUser);
  }

  async updateTask(taskId: string, payload: UpdateTaskRequest, currentUser: SessionUser) {
    const task = await this.findTask(taskId);
    this.ensureTaskAccess(task, currentUser, 'edit');
    const previousStatus = task.status;
    const previousAssigneeId = task.assigneeId;

    const updateData: Record<string, unknown> = {
      ...(payload.title !== undefined ? { title: payload.title } : {}),
      ...(payload.description !== undefined ? { description: payload.description } : {}),
      ...(payload.priority !== undefined ? { priority: payload.priority } : {}),
      ...(payload.status !== undefined ? { status: payload.status } : {}),
      ...(payload.dueDate !== undefined ? { dueDate: payload.dueDate ? new Date(payload.dueDate) : null } : {}),
    };

    if (payload.listId && payload.listId !== task.listId) {
      if (task.source === TaskSource.MANAGER_ASSIGNED) {
        throw new BadRequestException('Manager-assigned tasks stay in the fixed assigned list');
      }

      const targetList = await this.prisma.boardList.findFirst({
        where: {
          id: payload.listId,
          ownerId: currentUser.userId,
          deletedAt: null,
        },
      });

      if (!targetList) {
        throw new NotFoundException('Target list not found');
      }

      if (targetList.isFixed) {
        throw new BadRequestException('Personal tasks cannot be moved into the fixed assigned list');
      }

      updateData.listId = targetList.id;
      if (payload.status === undefined) {
        updateData.status = this.workspaceProvisionProvider.getStatusForListSlug(targetList.slug) as any;
      }
    }

    if (task.source === TaskSource.MANAGER_ASSIGNED && payload.assigneeId && payload.assigneeId !== task.assigneeId) {
      if (currentUser.roleCode !== RoleCode.ADMIN && currentUser.roleCode !== RoleCode.MANAGER) {
        throw new ForbiddenException('Only managers can reassign this task');
      }

      const assignee = await this.ensureEmployee(payload.assigneeId);
      const assignedList = await this.workspaceProvisionProvider.getAssignedList(assignee.id);
      if (!assignedList) {
        throw new BadRequestException('Assigned list is not available for this employee');
      }

      updateData.assigneeId = assignee.id;
      updateData.listId = assignedList.id;
      updateData.assigneeDismissedAt = null;
    }

    if (payload.status) {
      updateData.completedAt = payload.status === TaskStatus.DONE ? new Date() : null;
      if (payload.status !== TaskStatus.DONE) {
        updateData.assigneeDismissedAt = null;
      }
    }

    await this.prisma.task.update({
      where: { id: task.id },
      data: updateData,
    });

    if (payload.status && payload.status !== previousStatus) {
      await this.recordTaskStatusActivity(task.id, currentUser.userId, previousStatus, payload.status);
    }

    if (updateData.listId) {
      await this.normalizeListPositions(task.listId);
      await this.normalizeListPositions(updateData.listId as string);
    }

    const updatedTask = await this.findTask(task.id);
    if (updatedTask.source === TaskSource.MANAGER_ASSIGNED) {
      const actor = await this.findRealtimeActor(currentUser.userId);
      if (previousAssigneeId !== updatedTask.assigneeId) {
        this.realtimeService.emitTaskDeleted(previousAssigneeId, this.mapTaskSnapshot(task), actor);
        await this.emitTaskToObservers('task.updated', updatedTask, actor, {
          includeAssignee: false,
        });
        await this.emitTaskToAudience('task.assigned', updatedTask, actor, [updatedTask.assigneeId]);
      } else {
        await this.emitTaskToObservers('task.updated', updatedTask, actor);
      }
    }

    return ResponseApi.success({
      data: this.mapTask(updatedTask),
    });
  }

  async updateTaskStatus(taskId: string, payload: UpdateTaskStatusRequest, currentUser: SessionUser) {
    const task = await this.findTask(taskId);
    this.ensureStatusChangeAccess(task, currentUser);

    if (payload.status === task.status) {
      return ResponseApi.success({
        data: this.mapTask(task),
      });
    }

    await this.prisma.task.update({
      where: { id: task.id },
      data: {
        status: payload.status,
        completedAt: payload.status === TaskStatus.DONE ? new Date() : null,
        ...(payload.status !== TaskStatus.DONE ? { assigneeDismissedAt: null } : {}),
      },
    });

    await this.recordTaskStatusActivity(task.id, currentUser.userId, task.status, payload.status);

    const updatedTask = await this.findTask(task.id);
    if (updatedTask.source === TaskSource.MANAGER_ASSIGNED) {
      const actor = await this.findRealtimeActor(currentUser.userId);
      await this.emitTaskToObservers('task.updated', updatedTask, actor);
    }

    return ResponseApi.success({
      data: this.mapTask(updatedTask),
    });
  }

  async dismissAssignedTask(taskId: string, currentUser: SessionUser) {
    const task = await this.findTask(taskId);

    if (task.source !== TaskSource.MANAGER_ASSIGNED) {
      throw new BadRequestException('Only manager-assigned tasks can be dismissed');
    }

    if (task.assigneeId !== currentUser.userId) {
      throw new ForbiddenException('Only the assignee can dismiss this task');
    }

    if (task.status !== TaskStatus.DONE) {
      throw new BadRequestException('Task must be done before it can be dismissed');
    }

    if (task.assigneeDismissedAt) {
      return ResponseApi.success({
        data: true,
      });
    }

    await this.prisma.task.update({
      where: { id: task.id },
      data: {
        assigneeDismissedAt: new Date(),
      },
    });

    const actor = await this.findRealtimeActor(currentUser.userId);
    this.realtimeService.emitTaskDeleted(currentUser.userId, this.mapTaskSnapshot(task), actor);

    return ResponseApi.success({
      data: true,
    });
  }

  async moveTask(taskId: string, payload: MoveTaskRequest, currentUser: SessionUser) {
    const task = await this.findTask(taskId);
    this.ensureTaskAccess(task, currentUser, 'move');

    if (task.source === TaskSource.MANAGER_ASSIGNED) {
      throw new BadRequestException('Manager-assigned tasks stay in the fixed assigned list');
    }

    const targetList = await this.prisma.boardList.findFirst({
      where: {
        id: payload.listId,
        ownerId: currentUser.userId,
        deletedAt: null,
      },
    });

    if (!targetList) {
      throw new NotFoundException('Target list not found');
    }

    if (targetList.isFixed) {
      throw new BadRequestException('Tasks cannot be moved into the fixed assigned list');
    }

    const targetTasks = await this.prisma.task.findMany({
      where: {
        listId: targetList.id,
        deletedAt: null,
        id: { not: task.id },
      },
      orderBy: {
        position: 'asc',
      },
    });

    const position = payload.position ?? targetTasks.length;
    const orderedIds = targetTasks.map((item) => item.id);
    orderedIds.splice(Math.max(0, Math.min(position, orderedIds.length)), 0, task.id);

    await this.prisma.task.update({
      where: { id: task.id },
      data: {
        listId: targetList.id,
        status: this.workspaceProvisionProvider.getStatusForListSlug(targetList.slug) as any,
      },
    });

    await this.prisma.$transaction(
      orderedIds.map((id, index) =>
        this.prisma.task.update({
          where: { id },
          data: { position: index },
        }),
      ),
    );

    if (task.listId !== targetList.id) {
      await this.normalizeListPositions(task.listId);
    }

    const movedTask = await this.findTask(task.id);
    return ResponseApi.success({
      data: this.mapTask(movedTask),
    });
  }

  async addAttachments(taskId: string, files: Express.Multer.File[], currentUser: SessionUser) {
    const task = await this.findTask(taskId);
    this.ensureTaskAccess(task, currentUser, 'edit');

    const createdAttachments = await this.uploadAttachments(task.id, currentUser.userId, files);
    if (task.source === TaskSource.MANAGER_ASSIGNED) {
      const updatedTask = await this.findTask(task.id);
      const actor = await this.findRealtimeActor(currentUser.userId);
      await this.emitTaskToObservers('task.updated', updatedTask, actor);
    }

    return ResponseApi.success({
      data: createdAttachments,
    });
  }

  async deleteAttachment(taskId: string, attachmentId: string, currentUser: SessionUser) {
    const task = await this.findTask(taskId);
    this.ensureTaskAccess(task, currentUser, 'edit');

    const attachment = await this.prisma.taskAttachment.findFirst({
      where: {
        id: attachmentId,
        taskId,
      },
    });

    if (!attachment) {
      throw new NotFoundException('Attachment not found');
    }

    await this.cloudinaryProvider.destroy(
      attachment.publicId,
      attachment.kind === AttachmentKind.IMAGE ? 'image' : 'raw',
    );

    await this.prisma.taskAttachment.delete({
      where: { id: attachment.id },
    });

    if (task.source === TaskSource.MANAGER_ASSIGNED) {
      const updatedTask = await this.findTask(task.id);
      const actor = await this.findRealtimeActor(currentUser.userId);
      await this.emitTaskToObservers('task.updated', updatedTask, actor);
    }

    return ResponseApi.success({
      data: true,
    });
  }

  async deleteTask(taskId: string, currentUser: SessionUser) {
    const task = await this.findTask(taskId);
    this.ensureDeleteAccess(task, currentUser);

    for (const attachment of task.attachments) {
      await this.cloudinaryProvider.destroy(
        attachment.publicId,
        attachment.kind === AttachmentKind.IMAGE ? 'image' : 'raw',
      );
    }

    await this.prisma.task.update({
      where: { id: task.id },
      data: {
        deletedAt: new Date(),
      },
    });

    await this.normalizeListPositions(task.listId);

    if (task.source === TaskSource.MANAGER_ASSIGNED) {
      const actor = await this.findRealtimeActor(currentUser.userId);
      await this.emitTaskToAudience(
        'task.deleted',
        task,
        actor,
        await this.collectTaskObserverIds(task),
      );
    }

    return ResponseApi.success({
      data: true,
    });
  }

  private async createAssignedTask(
    payload: CreateTaskRequest,
    attachments: Express.Multer.File[],
    currentUser: SessionUser,
  ) {
    if (currentUser.roleCode !== RoleCode.ADMIN && currentUser.roleCode !== RoleCode.MANAGER) {
      throw new ForbiddenException('Only managers can assign employee tasks');
    }

    if (!payload.assigneeId) {
      throw new BadRequestException('Assignee is required');
    }

    const assignee = await this.ensureEmployee(payload.assigneeId);
    const assignedList = await this.workspaceProvisionProvider.getAssignedList(assignee.id);
    if (!assignedList) {
      throw new BadRequestException('Assigned list is not available for this employee');
    }

    const count = await this.prisma.task.count({
      where: {
        listId: assignedList.id,
        deletedAt: null,
      },
    });

    const task = await this.prisma.task.create({
      data: {
        title: payload.title,
        description: payload.description,
        priority: payload.priority ?? 'MEDIUM',
        status: payload.status ?? 'TODO',
        dueDate: payload.dueDate ? new Date(payload.dueDate) : null,
        position: count,
        source: TaskSource.MANAGER_ASSIGNED,
        listId: assignedList.id,
        creatorId: currentUser.userId,
        assigneeId: assignee.id,
        assignedById: currentUser.userId,
        isLockedForAssignee: true,
        completedAt: payload.status === TaskStatus.DONE ? new Date() : null,
        assigneeDismissedAt: null,
      },
    });

    await this.uploadAttachments(task.id, currentUser.userId, attachments);

    const createdTask = await this.findTask(task.id);
    const actor = await this.findRealtimeActor(currentUser.userId);
    await this.emitTaskToObservers('task.assigned', createdTask, actor);

    return ResponseApi.success({
      message: 'Created',
      status: 201,
      data: this.mapTask(createdTask),
    });
  }

  private async createSelfTask(payload: CreateTaskRequest, attachments: Express.Multer.File[], currentUser: SessionUser) {
    const targetList = payload.listId
      ? await this.prisma.boardList.findFirst({
          where: {
            id: payload.listId,
            ownerId: currentUser.userId,
            deletedAt: null,
          },
        })
      : await this.workspaceProvisionProvider.getFallbackTodoList(currentUser.userId);

    if (!targetList) {
      throw new BadRequestException('Target list is not available');
    }

    if (targetList.isFixed) {
      throw new BadRequestException('Personal tasks cannot be created in the fixed assigned list');
    }

    const count = await this.prisma.task.count({
      where: {
        listId: targetList.id,
        deletedAt: null,
      },
    });

    const task = await this.prisma.task.create({
      data: {
        title: payload.title,
        description: payload.description,
        priority: payload.priority ?? 'MEDIUM',
        status: payload.status ?? (this.workspaceProvisionProvider.getStatusForListSlug(targetList.slug) as any),
        dueDate: payload.dueDate ? new Date(payload.dueDate) : null,
        position: count,
        source: TaskSource.SELF_CREATED,
        listId: targetList.id,
        creatorId: currentUser.userId,
        assigneeId: currentUser.userId,
        completedAt: payload.status === TaskStatus.DONE ? new Date() : null,
      },
    });

    await this.uploadAttachments(task.id, currentUser.userId, attachments);

    const createdTask = await this.findTask(task.id);
    return ResponseApi.success({
      message: 'Created',
      status: 201,
      data: this.mapTask(createdTask),
    });
  }

  private async uploadAttachments(taskId: string, uploaderId: string, files: Express.Multer.File[]) {
    const uploads: any[] = [];

    for (const file of files) {
      const kind = getAttachmentKind(file.mimetype);
      const uploadResult = await this.cloudinaryProvider.uploadBuffer({
        buffer: file.buffer,
        folder: kind === AttachmentKind.IMAGE ? UploadFolder.TaskImage : UploadFolder.TaskFile,
        fileName: file.originalname,
        mimeType: file.mimetype,
        resourceType: kind === AttachmentKind.IMAGE ? 'image' : 'raw',
      });

      const attachment = await this.prisma.taskAttachment.create({
        data: {
          taskId,
          uploaderId,
          kind,
          url: uploadResult.secure_url,
          publicId: uploadResult.public_id,
          resourceType: uploadResult.resource_type,
          originalName: file.originalname,
          mimeType: file.mimetype,
          bytes: file.size,
          width: uploadResult.width ?? null,
          height: uploadResult.height ?? null,
        },
      });

      uploads.push(attachment);
    }

    return uploads;
  }

  private resolveTaskSource(payload: CreateTaskRequest, currentUser: SessionUser) {
    if (payload.source) {
      return payload.source;
    }

    if (payload.assigneeId && payload.assigneeId !== currentUser.userId) {
      return TaskSource.MANAGER_ASSIGNED;
    }

    return TaskSource.SELF_CREATED;
  }

  private async recordTaskStatusActivity(
    taskId: string,
    actorId: string,
    fromStatus: TaskStatus | null,
    toStatus: TaskStatus,
  ) {
    await this.prisma.taskStatusActivity.create({
      data: {
        taskId,
        actorId,
        fromStatus: fromStatus ?? undefined,
        toStatus,
      },
    });
  }

  private async ensureEmployee(userId: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        deletedAt: null,
        role: {
          code: RoleCode.EMPLOYEE,
        },
      },
    });

    if (!user) {
      throw new BadRequestException('Task can only be assigned to an active employee');
    }

    return user;
  }

  private async normalizeListPositions(listId: string) {
    const tasks = await this.prisma.task.findMany({
      where: {
        listId,
        deletedAt: null,
      },
      orderBy: {
        position: 'asc',
      },
    });

    await this.prisma.$transaction(
      tasks.map((task, index) =>
        this.prisma.task.update({
          where: { id: task.id },
          data: { position: index },
        }),
      ),
    );
  }

  private async findTask(taskId: string) {
    const task = await this.prisma.task.findFirst({
      where: {
        id: taskId,
        deletedAt: null,
      },
      include: {
        attachments: true,
        list: true,
        assignee: {
          include: {
            profile: true,
            role: true,
          },
        },
        creator: {
          include: {
            profile: true,
          },
        },
        assignedBy: {
          include: {
            profile: true,
          },
        },
      },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    return task;
  }

  private async findRealtimeActor(userId: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
      },
      include: {
        profile: true,
      },
    });

    if (!user) {
      return {
        id: userId,
        fullName: 'Unknown user',
      };
    }

    return {
      id: user.id,
      fullName: user.profile?.fullName ?? user.email,
    };
  }

  private async emitTaskToObservers(
    eventType: 'task.assigned' | 'task.updated' | 'task.deleted',
    task: Awaited<ReturnType<TaskService['findTask']>>,
    actor: { id: string; fullName: string },
    options?: {
      includeAssignee?: boolean;
    },
  ) {
    const recipients = await this.collectTaskObserverIds(task, options);
    await this.emitTaskToAudience(eventType, task, actor, recipients);
  }

  private async emitTaskToAudience(
    eventType: 'task.assigned' | 'task.updated' | 'task.deleted',
    task: Awaited<ReturnType<TaskService['findTask']>>,
    actor: { id: string; fullName: string },
    recipients: string[],
  ) {
    const snapshot = this.mapTaskSnapshot(task);

    for (const recipientId of recipients) {
      if (eventType === 'task.assigned') {
        this.realtimeService.emitTaskAssigned(recipientId, snapshot, actor);
        continue;
      }

      if (eventType === 'task.deleted') {
        this.realtimeService.emitTaskDeleted(recipientId, snapshot, actor);
        continue;
      }

      this.realtimeService.emitTaskUpdated(recipientId, snapshot, actor);
    }
  }

  private async collectTaskObserverIds(
    task: Awaited<ReturnType<TaskService['findTask']>>,
    options?: {
      includeAssignee?: boolean;
    },
  ) {
    const recipients = new Set<string>();

    if (options?.includeAssignee ?? true) {
      recipients.add(task.assigneeId);
    }

    if (task.assignedById) {
      recipients.add(task.assignedById);
    }

    const admins = await this.prisma.user.findMany({
      where: {
        deletedAt: null,
        role: {
          code: RoleCode.ADMIN,
        },
      },
      select: {
        id: true,
      },
    });

    for (const admin of admins) {
      recipients.add(admin.id);
    }

    return [...recipients];
  }

  private ensureTaskAccess(task: Awaited<ReturnType<TaskService['findTask']>>, currentUser: SessionUser, action: string) {
    if (currentUser.roleCode === RoleCode.ADMIN) {
      return;
    }

    if (task.source === TaskSource.MANAGER_ASSIGNED) {
      const canAccess =
        task.assigneeId === currentUser.userId ||
        (currentUser.roleCode === RoleCode.MANAGER && task.assignedById === currentUser.userId);

      if (!canAccess) {
        throw new ForbiddenException(`You do not have permission to ${action} this task`);
      }

      if (currentUser.roleCode === RoleCode.EMPLOYEE && action === 'edit') {
        throw new ForbiddenException('Employees can only change status on assigned tasks');
      }

      if (currentUser.roleCode === RoleCode.EMPLOYEE && action === 'move') {
        throw new ForbiddenException('Employees cannot move assigned tasks');
      }

      return;
    }

    if (task.assigneeId !== currentUser.userId) {
      throw new ForbiddenException(`You do not have permission to ${action} this task`);
    }
  }

  private ensureStatusChangeAccess(task: Awaited<ReturnType<TaskService['findTask']>>, currentUser: SessionUser) {
    if (currentUser.roleCode === RoleCode.ADMIN) {
      return;
    }

    if (task.source === TaskSource.MANAGER_ASSIGNED) {
      if (task.assigneeId !== currentUser.userId && task.assignedById !== currentUser.userId) {
        throw new ForbiddenException('You do not have permission to update this task status');
      }
      return;
    }

    if (task.assigneeId !== currentUser.userId) {
      throw new ForbiddenException('You do not have permission to update this task status');
    }
  }

  private ensureDeleteAccess(task: Awaited<ReturnType<TaskService['findTask']>>, currentUser: SessionUser) {
    if (currentUser.roleCode === RoleCode.ADMIN) {
      return;
    }

    if (task.source === TaskSource.MANAGER_ASSIGNED) {
      if (task.assignedById !== currentUser.userId) {
        throw new ForbiddenException('Only the manager who assigned this task can delete it');
      }
      return;
    }

    if (task.assigneeId !== currentUser.userId) {
      throw new ForbiddenException('You do not have permission to delete this task');
    }
  }

  private mapTask(task: Awaited<ReturnType<TaskService['findTask']>>) {
    return {
      id: task.id,
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      dueDate: task.dueDate,
      position: task.position,
      source: task.source,
      isLockedForAssignee: task.isLockedForAssignee,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
      completedAt: task.completedAt,
      list: {
        id: task.list.id,
        name: task.list.name,
        slug: task.list.slug,
      },
      assignee: {
        id: task.assignee.id,
        email: task.assignee.email,
        fullName: task.assignee.profile?.fullName ?? task.assignee.email,
        avatarUrl: task.assignee.profile?.avatarUrl ?? null,
        roleCode: task.assignee.role.code,
      },
      creator: {
        id: task.creator.id,
        fullName: task.creator.profile?.fullName ?? task.creator.email,
      },
      assignedBy: task.assignedBy
        ? {
            id: task.assignedBy.id,
            fullName: task.assignedBy.profile?.fullName ?? task.assignedBy.email,
          }
        : null,
      attachments: task.attachments,
    };
  }

  private mapTaskSnapshot(task: Awaited<ReturnType<TaskService['findTask']>>): RealtimeTaskSnapshot {
    return {
      id: task.id,
      title: task.title,
      status: task.status,
      priority: task.priority,
      dueDate: task.dueDate,
      source: task.source,
      list: {
        id: task.list.id,
        name: task.list.name,
      },
      assignee: {
        id: task.assignee.id,
        fullName: task.assignee.profile?.fullName ?? task.assignee.email,
      },
    };
  }
}
