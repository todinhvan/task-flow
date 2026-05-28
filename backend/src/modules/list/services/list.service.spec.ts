import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ListKind, TaskSource, TaskStatus } from '@/generated/prisma/enums';
import { ListService } from './list.service';

describe('ListService', () => {
  const prisma = {
    boardList: {
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findFirst: jest.fn(),
    },
    task: {
      findMany: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  const workspaceProvisionProvider = {
    getFallbackTodoList: jest.fn(),
    getStatusForListSlug: jest.fn(),
  };
  const service = new ListService(prisma as any, workspaceProvisionProvider as any);

  const customList = {
    id: 'list-1',
    ownerId: 'user-1',
    name: 'Backlog',
    slug: 'backlog',
    color: '#ffffff',
    description: 'Tasks',
    kind: ListKind.CUSTOM,
    isFixed: false,
    position: 0,
    deletedAt: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation(async (operations: unknown[]) => operations);
    workspaceProvisionProvider.getStatusForListSlug.mockReturnValue(TaskStatus.TODO);
  });

  it('returns the current user lists on the happy path', async () => {
    prisma.boardList.findMany.mockResolvedValue([
      {
        ...customList,
        tasks: [
          {
            id: 'task-1',
            title: 'Task One',
            description: 'Desc',
            status: TaskStatus.TODO,
            priority: 'MEDIUM',
            dueDate: null,
            position: 0,
            source: TaskSource.MANAGER_ASSIGNED,
            listId: customList.id,
            assignedById: 'manager-1',
            isLockedForAssignee: true,
            attachments: [],
            createdAt: new Date(),
            updatedAt: new Date(),
            completedAt: null,
            creator: {
              id: 'manager-1',
              email: 'manager@example.com',
              profile: { fullName: 'Manager One' },
            },
            assignee: {
              id: 'user-1',
              email: 'user@example.com',
              profile: { fullName: 'Employee One', avatarUrl: 'https://cdn.example/avatar.webp' },
            },
            assignedBy: {
              id: 'manager-1',
              email: 'manager@example.com',
              profile: { fullName: 'Manager One' },
            },
          },
        ],
      },
    ]);

    const result = await service.getMyLists('user-1');

    expect(result.data?.[0].tasks[0].assignedBy?.fullName).toBe('Manager One');
    expect(result.data?.[0].tasks[0].assignee.fullName).toBe('Employee One');
  });

  it('creates a list with a unique slug on the happy path', async () => {
    prisma.boardList.count.mockResolvedValue(2);
    prisma.boardList.findFirst.mockResolvedValueOnce({ id: 'list-existing' }).mockResolvedValueOnce(null);
    prisma.boardList.create.mockResolvedValue({ id: 'list-1', slug: 'backlog-1' });

    const result = await service.createList('user-1', {
      name: 'Backlog',
      description: 'Tasks',
      color: '#ffffff',
    });

    expect(prisma.boardList.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          slug: 'backlog-1',
          position: 2,
        }),
      }),
    );
    expect(result.status).toBe(201);
  });

  it('updates a mutable list on the happy path', async () => {
    prisma.boardList.findFirst.mockResolvedValueOnce(customList).mockResolvedValueOnce(null);
    prisma.boardList.update.mockResolvedValue({ ...customList, name: 'Doing', slug: 'doing' });

    const result = await service.updateList('user-1', 'list-1', {
      name: 'Doing',
      color: '#000000',
    });

    expect(prisma.boardList.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'list-1' },
        data: expect.objectContaining({
          name: 'Doing',
          slug: 'doing',
          color: '#000000',
        }),
      }),
    );
    expect(result.data?.slug).toBe('doing');
  });

  it('rejects editing fixed lists', async () => {
    prisma.boardList.findFirst.mockResolvedValue({
      ...customList,
      isFixed: true,
    });

    await expect(service.updateList('user-1', 'list-1', { name: 'Blocked' })).rejects.toThrow(BadRequestException);
  });

  it('rejects reordering lists with invalid ids', async () => {
    prisma.boardList.findMany.mockResolvedValue([{ id: 'list-1' }, { id: 'list-2' }]);

    await expect(
      service.reorderLists('user-1', {
        orderedListIds: ['list-1'],
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('reorders lists on the happy path', async () => {
    prisma.boardList.findMany.mockResolvedValue([{ id: 'list-1' }, { id: 'list-2' }]);
    prisma.boardList.update.mockImplementation(({ where, data }: any) => ({ id: where.id, ...data }));

    const result = await service.reorderLists('user-1', {
      orderedListIds: ['list-2', 'list-1'],
    });

    expect(prisma.$transaction).toHaveBeenCalled();
    expect(result.data).toBe(true);
  });

  it('deletes a custom list and moves tasks to the fallback list', async () => {
    prisma.boardList.findFirst.mockResolvedValueOnce(customList);
    workspaceProvisionProvider.getFallbackTodoList.mockResolvedValue({
      id: 'todo-list',
      slug: 'todo',
    });
    prisma.task.findMany.mockResolvedValue([{ id: 'task-1' }]);

    const result = await service.deleteList('user-1', 'list-1');

    expect(result.data).toBe(true);
    expect(prisma.$transaction).toHaveBeenCalled();
  });

  it('rejects deleting fixed lists', async () => {
    prisma.boardList.findFirst.mockResolvedValue({
      ...customList,
      isFixed: true,
      kind: ListKind.SYSTEM_ASSIGNED,
    });

    await expect(service.deleteList('user-1', 'list-1')).rejects.toThrow(BadRequestException);
  });

  it('rejects deleting a list when the fallback list is unavailable', async () => {
    prisma.boardList.findFirst.mockResolvedValue(customList);
    workspaceProvisionProvider.getFallbackTodoList.mockResolvedValue({
      id: 'list-1',
      slug: 'todo',
    });

    await expect(service.deleteList('user-1', 'list-1')).rejects.toThrow(BadRequestException);
  });

  it('throws when deleting a missing list', async () => {
    prisma.boardList.findFirst.mockResolvedValue(null);

    await expect(service.deleteList('user-1', 'missing')).rejects.toThrow(NotFoundException);
  });
});
