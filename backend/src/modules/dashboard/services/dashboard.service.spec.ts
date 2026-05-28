import { ForbiddenException } from '@nestjs/common';
import { RoleCode, TaskSource, TaskStatus } from '@/generated/prisma/enums';
import { DashboardService } from './dashboard.service';

describe('DashboardService', () => {
  const prisma = {
    user: { findMany: jest.fn() },
    role: { count: jest.fn() },
    permission: { count: jest.fn() },
    boardList: { count: jest.fn() },
    taskAttachment: { count: jest.fn() },
    task: { findMany: jest.fn() },
    taskStatusActivity: { findMany: jest.fn() },
  };
  const service = new DashboardService(prisma as any);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects non-admin dashboard access', async () => {
    await expect(service.getAdminDashboard(RoleCode.EMPLOYEE)).rejects.toThrow(ForbiddenException);
  });

  it('builds dashboard analytics on the happy path', async () => {
    prisma.user.findMany
      .mockResolvedValueOnce([
        {
          id: 'admin-1',
          email: 'admin@example.com',
          status: 'ACTIVE',
          role: { code: RoleCode.ADMIN },
        },
        {
          id: 'employee-1',
          email: 'employee@example.com',
          status: 'BLOCKED',
          role: { code: RoleCode.EMPLOYEE },
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'employee-1',
          email: 'employee@example.com',
          profile: { fullName: 'Employee One' },
          assignedTasks: [
            {
              status: TaskStatus.DONE,
              dueDate: new Date(Date.now() - 60_000),
            },
          ],
        },
      ]);
    prisma.role.count.mockResolvedValue(3);
    prisma.permission.count.mockResolvedValue(8);
    prisma.boardList.count.mockResolvedValue(4);
    prisma.taskAttachment.count.mockResolvedValue(2);
    prisma.task.findMany
      .mockResolvedValueOnce([
        {
          id: 'task-1',
          title: 'Task One',
          status: TaskStatus.DONE,
          priority: 'MEDIUM',
          source: TaskSource.MANAGER_ASSIGNED,
          dueDate: new Date(Date.now() - 60_000),
          assignee: { id: 'employee-1', email: 'employee@example.com', profile: { fullName: 'Employee One' } },
          assignedBy: null,
          list: { id: 'list-1', name: 'Assigned' },
          createdAt: new Date(),
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'task-1',
          title: 'Task One',
          status: TaskStatus.DONE,
          priority: 'MEDIUM',
          source: TaskSource.MANAGER_ASSIGNED,
          dueDate: null,
          assignee: { id: 'employee-1', email: 'employee@example.com', profile: { fullName: 'Employee One' } },
          assignedBy: null,
          list: { id: 'list-1', name: 'Assigned' },
          createdAt: new Date(),
        },
      ]);
    prisma.taskStatusActivity.findMany.mockResolvedValue([
      {
        createdAt: new Date('2026-05-28T08:30:00.000Z'),
        actor: {
          email: 'employee@example.com',
          profile: { fullName: 'Employee One' },
        },
      },
    ]);

    const result = await service.getAdminDashboard(RoleCode.ADMIN);

    expect(result.data?.summary.totalUsers).toBe(2);
    expect(result.data?.tasksByStatus.find((item) => item.status === TaskStatus.DONE)?.count).toBe(1);
    expect(result.data?.focusHeatmap.maxCount).toBeGreaterThanOrEqual(1);
  });
});
