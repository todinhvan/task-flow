import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { AttachmentKind, RoleCode, TaskSource, TaskStatus } from '@/generated/prisma/enums';
import { TaskService } from './task.service';

describe('TaskService', () => {
  const prisma = {
    task: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    boardList: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    user: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    taskAttachment: {
      create: jest.fn(),
      findFirst: jest.fn(),
      delete: jest.fn(),
    },
    taskStatusActivity: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  const cloudinaryProvider = {
    uploadBuffer: jest.fn(),
    destroy: jest.fn(),
  };
  const workspaceProvisionProvider = {
    getAssignedList: jest.fn(),
    getFallbackTodoList: jest.fn(),
    getStatusForListSlug: jest.fn(),
  };
  const realtimeService = {
    emitTaskAssigned: jest.fn(),
    emitTaskUpdated: jest.fn(),
    emitTaskDeleted: jest.fn(),
  };
  const service = new TaskService(
    prisma as any,
    cloudinaryProvider as any,
    workspaceProvisionProvider as any,
    realtimeService as any,
  );

  const makeTask = (overrides: Record<string, any> = {}) => ({
    id: 'task-1',
    title: 'Task One',
    description: 'Description',
    status: TaskStatus.TODO,
    priority: 'MEDIUM',
    dueDate: null,
    position: 0,
    source: TaskSource.SELF_CREATED,
    listId: 'list-1',
    assigneeId: 'user-1',
    assignedById: null,
    isLockedForAssignee: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    completedAt: null,
    assigneeDismissedAt: null,
    attachments: [],
    list: { id: 'list-1', name: 'To Do', slug: 'todo' },
    assignee: { id: 'user-1', email: 'user@example.com', profile: null, role: { code: RoleCode.EMPLOYEE } },
    creator: { id: 'user-1', email: 'user@example.com', profile: null },
    assignedBy: null,
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    prisma.$transaction.mockImplementation(async (operations: unknown[]) => operations);
    workspaceProvisionProvider.getStatusForListSlug.mockImplementation((slug: string) =>
      slug === 'done' ? TaskStatus.DONE : slug === 'in-progress' ? TaskStatus.IN_PROGRESS : TaskStatus.TODO,
    );
    cloudinaryProvider.uploadBuffer.mockResolvedValue({
      secure_url: 'https://cdn.example/file',
      public_id: 'public-file',
      resource_type: 'raw',
    });
    prisma.user.findFirst.mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
      profile: { fullName: 'User One' },
    });
    prisma.user.findMany.mockResolvedValue([]);
    prisma.taskAttachment.create.mockImplementation(({ data }: any) => ({ id: 'attachment-1', ...data }));
  });

  it('lists tasks for administrators on the happy path', async () => {
    prisma.task.findMany.mockResolvedValue([makeTask({ source: TaskSource.MANAGER_ASSIGNED })]);

    const result = await service.listTasks({}, { userId: 'admin-1', roleCode: RoleCode.ADMIN });

    expect(result.data).toHaveLength(1);
    expect(prisma.task.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          source: TaskSource.MANAGER_ASSIGNED,
        }),
      }),
    );
  });

  it('gets a task by id on the happy path', async () => {
    jest.spyOn(service as any, 'findTask').mockResolvedValue(makeTask());

    const result = await service.getTaskById('task-1', { userId: 'user-1', roleCode: RoleCode.EMPLOYEE });

    expect(result.data?.id).toBe('task-1');
  });

  it('routes to self task creation when source resolves to self-created', async () => {
    const createSelfTaskSpy = jest.spyOn(service as any, 'createSelfTask').mockResolvedValue('created-self-task');
    const createAssignedTaskSpy = jest.spyOn(service as any, 'createAssignedTask').mockResolvedValue('created-assigned-task');

    const result = await service.createTask(
      {
        title: 'Task One',
      },
      [],
      { userId: 'user-1', roleCode: RoleCode.EMPLOYEE },
    );

    expect(createSelfTaskSpy).toHaveBeenCalled();
    expect(createAssignedTaskSpy).not.toHaveBeenCalled();
    expect(result).toBe('created-self-task');
  });

  it('creates a self task on the happy path', async () => {
    workspaceProvisionProvider.getFallbackTodoList.mockResolvedValue({
      id: 'list-1',
      slug: 'todo',
      isFixed: false,
    });
    prisma.task.count.mockResolvedValue(3);
    prisma.task.create.mockResolvedValue({ id: 'task-1' });
    jest.spyOn(service as any, 'findTask').mockResolvedValue(makeTask());

    const result = await service.createTask(
      {
        title: 'Task One',
        description: 'Description',
      },
      [
        {
          buffer: Buffer.from('file'),
          originalname: 'notes.txt',
          mimetype: 'text/plain',
          size: 64,
        } as Express.Multer.File,
      ],
      { userId: 'user-1', roleCode: RoleCode.EMPLOYEE },
    );

    expect(prisma.task.create).toHaveBeenCalled();
    expect(prisma.taskAttachment.create).toHaveBeenCalled();
    expect(result.status).toBe(201);
  });

  it('rejects self task creation in a fixed list', async () => {
    workspaceProvisionProvider.getFallbackTodoList.mockResolvedValue({
      id: 'assigned-list',
      slug: 'todo',
      isFixed: true,
    });

    await expect(
      service.createTask(
        {
          title: 'Task One',
        },
        [],
        { userId: 'user-1', roleCode: RoleCode.EMPLOYEE },
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('creates a manager-assigned task on the happy path', async () => {
    prisma.user.findFirst.mockResolvedValue({ id: 'employee-1' });
    workspaceProvisionProvider.getAssignedList.mockResolvedValue({
      id: 'assigned-list',
    });
    prisma.task.count.mockResolvedValue(1);
    prisma.task.create.mockResolvedValue({ id: 'task-1' });
    jest.spyOn(service as any, 'findTask').mockResolvedValue(
      makeTask({
        source: TaskSource.MANAGER_ASSIGNED,
        assigneeId: 'employee-1',
        assignedById: 'manager-1',
        assignedBy: { id: 'manager-1', email: 'manager@example.com', profile: { fullName: 'Manager One' } },
      }),
    );

    const result = await service.createTask(
      {
        title: 'Assigned Task',
        assigneeId: 'employee-1',
      },
      [],
      { userId: 'manager-1', roleCode: RoleCode.MANAGER },
    );

    expect(prisma.task.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          source: TaskSource.MANAGER_ASSIGNED,
          assignedById: 'manager-1',
        }),
      }),
    );
    expect(result.status).toBe(201);
  });

  it('rejects assigned task creation by employees', async () => {
    await expect(
      service.createTask(
        {
          title: 'Assigned Task',
          assigneeId: 'employee-1',
        },
        [],
        { userId: 'user-1', roleCode: RoleCode.EMPLOYEE },
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('rejects assigned task creation without an assignee', async () => {
    await expect(
      service.createTask(
        {
          title: 'Assigned Task',
          source: TaskSource.MANAGER_ASSIGNED,
        },
        [],
        { userId: 'manager-1', roleCode: RoleCode.MANAGER },
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects assigned task creation when the assignee is invalid', async () => {
    prisma.user.findFirst.mockResolvedValue(null);

    await expect(
      service.createTask(
        {
          title: 'Assigned Task',
          assigneeId: 'missing-employee',
        },
        [],
        { userId: 'manager-1', roleCode: RoleCode.MANAGER },
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects assigned task creation when the assigned list is unavailable', async () => {
    prisma.user.findFirst.mockResolvedValue({ id: 'employee-1' });
    workspaceProvisionProvider.getAssignedList.mockResolvedValue(null);

    await expect(
      service.createTask(
        {
          title: 'Assigned Task',
          assigneeId: 'employee-1',
        },
        [],
        { userId: 'manager-1', roleCode: RoleCode.MANAGER },
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('returns early when updating a status to the same value', async () => {
    jest.spyOn(service as any, 'findTask').mockResolvedValue(makeTask());

    const result = await service.updateTaskStatus(
      'task-1',
      { status: TaskStatus.TODO },
      { userId: 'user-1', roleCode: RoleCode.EMPLOYEE },
    );

    expect(result.data?.status).toBe(TaskStatus.TODO);
    expect(prisma.task.update).not.toHaveBeenCalled();
  });

  it('updates task status on the happy path', async () => {
    jest
      .spyOn(service as any, 'findTask')
      .mockResolvedValueOnce(makeTask())
      .mockResolvedValueOnce(makeTask({ status: TaskStatus.DONE, completedAt: new Date() }));

    const result = await service.updateTaskStatus(
      'task-1',
      { status: TaskStatus.DONE },
      { userId: 'user-1', roleCode: RoleCode.EMPLOYEE },
    );

    expect(prisma.task.update).toHaveBeenCalled();
    expect(prisma.taskStatusActivity.create).toHaveBeenCalled();
    expect(result.data?.status).toBe(TaskStatus.DONE);
  });

  it('dismisses a done manager-assigned task for the assignee', async () => {
    jest.spyOn(service as any, 'findTask').mockResolvedValue(
      makeTask({
        source: TaskSource.MANAGER_ASSIGNED,
        status: TaskStatus.DONE,
        assigneeId: 'user-1',
        assignedById: 'manager-1',
      }),
    );
    prisma.task.update.mockResolvedValue(undefined);

    const result = await service.dismissAssignedTask('task-1', {
      userId: 'user-1',
      roleCode: RoleCode.EMPLOYEE,
    });

    expect(prisma.task.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          assigneeDismissedAt: expect.any(Date),
        }),
      }),
    );
    expect(realtimeService.emitTaskDeleted).toHaveBeenCalled();
    expect(result.data).toBe(true);
  });

  it('updates a self-created task and moves it to another list on the happy path', async () => {
    jest
      .spyOn(service as any, 'findTask')
      .mockResolvedValueOnce(makeTask())
      .mockResolvedValueOnce(
        makeTask({
          listId: 'list-2',
          list: { id: 'list-2', name: 'Done', slug: 'done' },
          status: TaskStatus.DONE,
        }),
      );
    jest.spyOn(service as any, 'normalizeListPositions').mockResolvedValue(undefined);
    prisma.boardList.findFirst.mockResolvedValue({
      id: 'list-2',
      ownerId: 'user-1',
      deletedAt: null,
      isFixed: false,
      slug: 'done',
    });
    prisma.task.update.mockResolvedValue(undefined);

    const result = await service.updateTask(
      'task-1',
      {
        listId: 'list-2',
        status: TaskStatus.DONE,
      },
      { userId: 'user-1', roleCode: RoleCode.EMPLOYEE },
    );

    expect(prisma.task.update).toHaveBeenCalled();
    expect(prisma.taskStatusActivity.create).toHaveBeenCalled();
    expect(result.data?.list.slug).toBe('done');
  });

  it('rejects moving self-created tasks into fixed lists during update', async () => {
    jest.spyOn(service as any, 'findTask').mockResolvedValue(makeTask());
    prisma.boardList.findFirst.mockResolvedValue({
      id: 'list-2',
      ownerId: 'user-1',
      deletedAt: null,
      isFixed: true,
    });

    await expect(
      service.updateTask(
        'task-1',
        {
          listId: 'list-2',
        },
        { userId: 'user-1', roleCode: RoleCode.EMPLOYEE },
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects updates when the target list does not exist', async () => {
    jest.spyOn(service as any, 'findTask').mockResolvedValue(makeTask());
    prisma.boardList.findFirst.mockResolvedValue(null);

    await expect(
      service.updateTask(
        'task-1',
        {
          listId: 'missing-list',
        },
        { userId: 'user-1', roleCode: RoleCode.EMPLOYEE },
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('rejects reassigning manager-assigned tasks by employees', async () => {
    jest.spyOn(service as any, 'findTask').mockResolvedValue(
      makeTask({
        source: TaskSource.MANAGER_ASSIGNED,
        assigneeId: 'user-1',
        assignedById: 'manager-1',
        assignedBy: { id: 'manager-1', email: 'manager@example.com', profile: null },
      }),
    );

    await expect(
      service.updateTask(
        'task-1',
        { assigneeId: 'employee-2' },
        { userId: 'user-1', roleCode: RoleCode.EMPLOYEE },
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('reassigns manager-assigned tasks on the happy path', async () => {
    jest
      .spyOn(service as any, 'findTask')
      .mockResolvedValueOnce(
        makeTask({
          source: TaskSource.MANAGER_ASSIGNED,
          assigneeId: 'employee-1',
          assignedById: 'manager-1',
          assignedBy: { id: 'manager-1', email: 'manager@example.com', profile: null },
        }),
      )
      .mockResolvedValueOnce(
        makeTask({
          source: TaskSource.MANAGER_ASSIGNED,
          listId: 'assigned-list',
          assigneeId: 'employee-2',
          assignedById: 'manager-1',
          assignedBy: { id: 'manager-1', email: 'manager@example.com', profile: null },
          assignee: {
            id: 'employee-2',
            email: 'employee2@example.com',
            profile: null,
            role: { code: RoleCode.EMPLOYEE },
          },
        }),
      );
    jest.spyOn(service as any, 'normalizeListPositions').mockResolvedValue(undefined);
    prisma.user.findFirst.mockResolvedValue({ id: 'employee-2' });
    workspaceProvisionProvider.getAssignedList.mockResolvedValue({ id: 'assigned-list' });
    prisma.task.update.mockResolvedValue(undefined);

    const result = await service.updateTask(
      'task-1',
      { assigneeId: 'employee-2' },
      { userId: 'manager-1', roleCode: RoleCode.MANAGER },
    );

    expect(prisma.task.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          assigneeId: 'employee-2',
          listId: 'assigned-list',
        }),
      }),
    );
    expect(result.data?.assignee.id).toBe('employee-2');
  });

  it('rejects reassignment when the employee assigned list is unavailable', async () => {
    jest.spyOn(service as any, 'findTask').mockResolvedValue(
      makeTask({
        source: TaskSource.MANAGER_ASSIGNED,
        assigneeId: 'employee-1',
        assignedById: 'manager-1',
        assignedBy: { id: 'manager-1', email: 'manager@example.com', profile: null },
      }),
    );
    prisma.user.findFirst.mockResolvedValue({ id: 'employee-2' });
    workspaceProvisionProvider.getAssignedList.mockResolvedValue(null);

    await expect(
      service.updateTask(
        'task-1',
        { assigneeId: 'employee-2' },
        { userId: 'manager-1', roleCode: RoleCode.MANAGER },
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('moves a self-created task across lists on the happy path', async () => {
    jest
      .spyOn(service as any, 'findTask')
      .mockResolvedValueOnce(makeTask())
      .mockResolvedValueOnce(
        makeTask({
          listId: 'list-2',
          list: { id: 'list-2', name: 'In Progress', slug: 'in-progress' },
          status: TaskStatus.IN_PROGRESS,
        }),
      );
    jest.spyOn(service as any, 'normalizeListPositions').mockResolvedValue(undefined);
    prisma.boardList.findFirst.mockResolvedValue({
      id: 'list-2',
      ownerId: 'user-1',
      deletedAt: null,
      isFixed: false,
      slug: 'in-progress',
    });
    prisma.task.findMany.mockResolvedValue([{ id: 'task-2' }, { id: 'task-3' }]);
    prisma.task.update.mockResolvedValue(undefined);

    const result = await service.moveTask(
      'task-1',
      { listId: 'list-2', position: 1 },
      { userId: 'user-1', roleCode: RoleCode.EMPLOYEE },
    );

    expect(prisma.$transaction).toHaveBeenCalled();
    expect(result.data?.list.id).toBe('list-2');
  });

  it('rejects moving manager-assigned tasks across lists', async () => {
    jest.spyOn(service as any, 'findTask').mockResolvedValue({
      ...makeTask(),
      source: TaskSource.MANAGER_ASSIGNED,
      assignedById: 'manager-1',
    });

    await expect(
      service.moveTask(
        'task-1',
        { listId: 'list-2' },
        { userId: 'manager-1', roleCode: RoleCode.MANAGER },
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects moving a task when the target list does not exist', async () => {
    jest.spyOn(service as any, 'findTask').mockResolvedValue(makeTask());
    prisma.boardList.findFirst.mockResolvedValue(null);

    await expect(
      service.moveTask(
        'task-1',
        { listId: 'missing-list' },
        { userId: 'user-1', roleCode: RoleCode.EMPLOYEE },
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('rejects moving a task into a fixed list', async () => {
    jest.spyOn(service as any, 'findTask').mockResolvedValue(makeTask());
    prisma.boardList.findFirst.mockResolvedValue({
      id: 'list-2',
      ownerId: 'user-1',
      deletedAt: null,
      isFixed: true,
      slug: 'assigned',
    });

    await expect(
      service.moveTask(
        'task-1',
        { listId: 'list-2' },
        { userId: 'user-1', roleCode: RoleCode.EMPLOYEE },
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('adds attachments on the happy path', async () => {
    jest.spyOn(service as any, 'findTask').mockResolvedValue(makeTask());

    const result = await service.addAttachments(
      'task-1',
      [
        {
          buffer: Buffer.from('img'),
          originalname: 'image.png',
          mimetype: 'image/png',
          size: 64,
        } as Express.Multer.File,
      ],
      { userId: 'user-1', roleCode: RoleCode.EMPLOYEE },
    );

    expect(cloudinaryProvider.uploadBuffer).toHaveBeenCalledWith(
      expect.objectContaining({
        resourceType: 'image',
      }),
    );
    expect(result.data).toHaveLength(1);
  });

  it('throws when deleting a missing attachment', async () => {
    jest.spyOn(service as any, 'findTask').mockResolvedValue(makeTask());
    prisma.taskAttachment.findFirst.mockResolvedValue(null);

    await expect(
      service.deleteAttachment(
        'task-1',
        'missing',
        { userId: 'user-1', roleCode: RoleCode.EMPLOYEE },
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('deletes an attachment on the happy path', async () => {
    jest.spyOn(service as any, 'findTask').mockResolvedValue(makeTask());
    prisma.taskAttachment.findFirst.mockResolvedValue({
      id: 'attachment-1',
      taskId: 'task-1',
      publicId: 'image-1',
      kind: AttachmentKind.IMAGE,
    });
    prisma.taskAttachment.delete.mockResolvedValue(undefined);

    const result = await service.deleteAttachment(
      'task-1',
      'attachment-1',
      { userId: 'user-1', roleCode: RoleCode.EMPLOYEE },
    );

    expect(cloudinaryProvider.destroy).toHaveBeenCalledWith('image-1', 'image');
    expect(result.data).toBe(true);
  });

  it('deletes task attachments and soft deletes the task on the happy path', async () => {
    jest.spyOn(service as any, 'findTask').mockResolvedValue({
      ...makeTask(),
      attachments: [
        {
          publicId: 'image-1',
          kind: AttachmentKind.IMAGE,
        },
      ],
    });
    jest.spyOn(service as any, 'normalizeListPositions').mockResolvedValue(undefined);
    prisma.task.update.mockResolvedValue(undefined);

    const result = await service.deleteTask(
      'task-1',
      { userId: 'user-1', roleCode: RoleCode.EMPLOYEE },
    );

    expect(cloudinaryProvider.destroy).toHaveBeenCalledWith('image-1', 'image');
    expect(result.data).toBe(true);
  });

  it('blocks deleting manager-assigned tasks by non-assigners', async () => {
    jest.spyOn(service as any, 'findTask').mockResolvedValue(
      makeTask({
        source: TaskSource.MANAGER_ASSIGNED,
        assigneeId: 'employee-1',
        assignedById: 'manager-1',
      }),
    );

    await expect(
      service.deleteTask('task-1', { userId: 'manager-2', roleCode: RoleCode.MANAGER }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('rejects status updates from unrelated users', async () => {
    jest.spyOn(service as any, 'findTask').mockResolvedValue(makeTask());

    await expect(
      service.updateTaskStatus(
        'task-1',
        { status: TaskStatus.DONE },
        { userId: 'other-user', roleCode: RoleCode.EMPLOYEE },
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('throws when the task does not exist', async () => {
    jest.spyOn(service as any, 'findTask').mockRejectedValue(new NotFoundException('Task not found'));

    await expect(
      service.getTaskById('missing-task', { userId: 'user-1', roleCode: RoleCode.EMPLOYEE }),
    ).rejects.toThrow(NotFoundException);
  });

  it('blocks self-created task access for other employees', async () => {
    jest.spyOn(service as any, 'findTask').mockResolvedValue(makeTask());

    await expect(
      service.getTaskById('task-1', { userId: 'other-user', roleCode: RoleCode.EMPLOYEE }),
    ).rejects.toThrow(ForbiddenException);
  });
});
