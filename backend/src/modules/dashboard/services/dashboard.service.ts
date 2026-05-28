import { RoleCode, TaskSource, TaskStatus } from '@/generated/prisma/enums';
import { ResponseApi } from '@/shared/interfaces/common/response.interface';
import { PrismaProvider } from '@/shared/providers/prisma.provider';
import { ForbiddenException, Injectable } from '@nestjs/common';

const ADMIN_ONLY_MESSAGE = 'Only administrators can perform this action';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaProvider) {}

  async getAdminDashboard(currentRoleCode: string) {
    this.ensureAdmin(currentRoleCode);

    const rangeDays = 5;
    const heatmapSlotHours = [8, 10, 12, 14, 16, 18];
    const rangeStart = this.startOfDay(this.addDays(new Date(), -(rangeDays - 1)));

    const [users, rolesCount, permissionsCount, listsCount, attachmentsCount, tasks, employees, recentTasks, statusActivities] =
      await Promise.all([
        this.prisma.user.findMany({
          where: {
            deletedAt: null,
          },
          include: {
            role: true,
          },
        }),
        this.prisma.role.count({
          where: {
            deletedAt: null,
          },
        }),
        this.prisma.permission.count({
          where: {
            deletedAt: null,
          },
        }),
        this.prisma.boardList.count({
          where: {
            deletedAt: null,
          },
        }),
        this.prisma.taskAttachment.count(),
        this.prisma.task.findMany({
          where: {
            deletedAt: null,
          },
          include: {
            assignee: {
              include: {
                profile: true,
              },
            },
            assignedBy: {
              include: {
                profile: true,
              },
            },
            list: true,
          },
          orderBy: [{ createdAt: 'desc' }],
        }),
        this.prisma.user.findMany({
          where: {
            deletedAt: null,
            role: {
              code: RoleCode.EMPLOYEE,
            },
          },
          include: {
            profile: true,
            assignedTasks: {
              where: {
                deletedAt: null,
              },
            },
          },
        }),
        this.prisma.task.findMany({
          where: {
            deletedAt: null,
          },
          take: 6,
          orderBy: {
            createdAt: 'desc',
          },
          include: {
            assignee: {
              include: {
                profile: true,
              },
            },
            assignedBy: {
              include: {
                profile: true,
              },
            },
            list: true,
          },
        }),
        this.prisma.taskStatusActivity.findMany({
          where: {
            createdAt: {
              gte: rangeStart,
            },
            task: {
              deletedAt: null,
              source: TaskSource.MANAGER_ASSIGNED,
            },
            actor: {
              deletedAt: null,
              role: {
                code: RoleCode.EMPLOYEE,
              },
            },
          },
          include: {
            actor: {
              include: {
                profile: true,
              },
            },
          },
          orderBy: {
            createdAt: 'asc',
          },
        }),
      ]);

    const now = new Date();
    const activeUsers = users.filter((user) => user.status === 'ACTIVE').length;
    const blockedUsers = users.filter((user) => user.status === 'BLOCKED').length;
    const managerCount = users.filter((user) => user.role.code === RoleCode.MANAGER).length;
    const employeeCount = users.filter((user) => user.role.code === RoleCode.EMPLOYEE).length;
    const overdueTasks = tasks.filter(
      (task) => task.dueDate && task.dueDate < now && task.status !== TaskStatus.DONE,
    ).length;
    const completedTasks = tasks.filter((task) => task.status === TaskStatus.DONE).length;
    const inProgressTasks = tasks.filter((task) => task.status === TaskStatus.IN_PROGRESS).length;
    const managerAssignedTasks = tasks.filter((task) => task.source === TaskSource.MANAGER_ASSIGNED).length;
    const personalTasks = tasks.filter((task) => task.source === TaskSource.SELF_CREATED).length;

    const tasksByStatus = [
      TaskStatus.TODO,
      TaskStatus.IN_PROGRESS,
      TaskStatus.BLOCKED,
      TaskStatus.DONE,
    ].map((status) => ({
      status,
      count: tasks.filter((task) => task.status === status).length,
    }));

    const roleDistribution = [RoleCode.ADMIN, RoleCode.MANAGER, RoleCode.EMPLOYEE].map((code) => ({
      roleCode: code,
      count: users.filter((user) => user.role.code === code).length,
    }));

    const workload = employees
      .map((employee) => {
        const employeeTasks = employee.assignedTasks;
        return {
          id: employee.id,
          fullName: employee.profile?.fullName ?? employee.email,
          assignedCount: employeeTasks.length,
          completedCount: employeeTasks.filter((task) => task.status === TaskStatus.DONE).length,
          overdueCount: employeeTasks.filter(
            (task) => task.dueDate && task.dueDate < now && task.status !== TaskStatus.DONE,
          ).length,
        };
      })
      .sort((left, right) => right.assignedCount - left.assignedCount)
      .slice(0, 5);

    const heatmapRows = Array.from({ length: rangeDays }, (_, index) => {
      const date = this.startOfDay(this.addDays(rangeStart, index));
      const dateKey = this.toDateKey(date);

      return {
        dateKey,
        label: this.toDayLabel(date),
        cells: heatmapSlotHours.map((hour) => ({
          hour,
          label: this.toHourLabel(hour),
          count: 0,
          employeeCount: 0,
          employees: new Set<string>(),
        })),
      };
    });

    const rowMap = new Map(heatmapRows.map((row) => [row.dateKey, row]));

    for (const activity of statusActivities) {
      const dateKey = this.toDateKey(activity.createdAt);
      const row = rowMap.get(dateKey);
      if (!row) {
        continue;
      }

      const slotHour = this.resolveHeatmapSlot(activity.createdAt.getHours(), heatmapSlotHours);
      if (slotHour === null) {
        continue;
      }

      const cell = row.cells.find((item) => item.hour === slotHour);
      if (!cell) {
        continue;
      }

      cell.count += 1;
      cell.employees.add(activity.actor.profile?.fullName ?? activity.actor.email);
      cell.employeeCount = cell.employees.size;
    }

    const heatmapMaxCount = Math.max(
      1,
      ...heatmapRows.flatMap((row) => row.cells.map((cell) => cell.count)),
    );

    return ResponseApi.success({
      data: {
        summary: {
          totalUsers: users.length,
          activeUsers,
          blockedUsers,
          totalRoles: rolesCount,
          totalPermissions: permissionsCount,
          totalLists: listsCount,
          totalAttachments: attachmentsCount,
          totalTasks: tasks.length,
          managerAssignedTasks,
          personalTasks,
          completedTasks,
          inProgressTasks,
          overdueTasks,
          managers: managerCount,
          employees: employeeCount,
        },
        tasksByStatus,
        roleDistribution,
        workload,
        focusHeatmap: {
          maxCount: heatmapMaxCount,
          timeSlots: heatmapSlotHours.map((hour) => ({
            hour,
            label: this.toHourLabel(hour),
          })),
          rows: heatmapRows.map((row) => ({
            dateKey: row.dateKey,
            label: row.label,
            cells: row.cells.map((cell) => ({
              hour: cell.hour,
              label: cell.label,
              count: cell.count,
              employeeCount: cell.employeeCount,
              employees: Array.from(cell.employees),
              intensity: cell.count / heatmapMaxCount,
            })),
          })),
        },
        recentTasks: recentTasks.map((task) => ({
          id: task.id,
          title: task.title,
          status: task.status,
          priority: task.priority,
          source: task.source,
          dueDate: task.dueDate,
          list: {
            id: task.list.id,
            name: task.list.name,
          },
          assignee: {
            id: task.assignee.id,
            fullName: task.assignee.profile?.fullName ?? task.assignee.email,
          },
          assignedBy: task.assignedBy
            ? {
                id: task.assignedBy.id,
                fullName: task.assignedBy.profile?.fullName ?? task.assignedBy.email,
              }
            : null,
          createdAt: task.createdAt,
        })),
      },
    });
  }

  private ensureAdmin(roleCode: string) {
    if (roleCode !== RoleCode.ADMIN) {
      throw new ForbiddenException(ADMIN_ONLY_MESSAGE);
    }
  }

  private addDays(date: Date, amount: number) {
    const next = new Date(date);
    next.setDate(next.getDate() + amount);
    return next;
  }

  private startOfDay(date: Date) {
    const next = new Date(date);
    next.setHours(0, 0, 0, 0);
    return next;
  }

  private toDateKey(date: Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private toDayLabel(date: Date) {
    const dayLabel = date.toLocaleDateString('en-US', { weekday: 'short' });
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${dayLabel} ${day}/${month}`;
  }

  private toHourLabel(hour: number) {
    const suffix = hour >= 12 ? 'PM' : 'AM';
    const normalized = hour > 12 ? hour - 12 : hour;
    return `${normalized} ${suffix}`;
  }

  private resolveHeatmapSlot(hour: number, slots: number[]) {
    const candidates = slots.filter((slot) => hour >= slot && hour < slot + 2);
    return candidates[0] ?? null;
  }
}
