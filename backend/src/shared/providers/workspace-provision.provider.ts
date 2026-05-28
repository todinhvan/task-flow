import { ListKind, TaskStatus } from '@/generated/prisma/enums';
import { Injectable } from '@nestjs/common';
import { DefaultBoardListSlug } from '../constants/role.constant';
import { PrismaProvider } from './prisma.provider';

type ProvisionUserInput = {
  userId: string;
  fullName: string;
  jobTitle?: string | null;
};

@Injectable()
export class WorkspaceProvisionProvider {
  constructor(private readonly prisma: PrismaProvider) {}

  async provisionForUser({ userId, fullName, jobTitle }: ProvisionUserInput) {
    await this.prisma.userProfile.upsert({
      where: { userId },
      create: {
        userId,
        fullName,
        jobTitle,
      },
      update: {
        fullName,
        ...(jobTitle !== undefined ? { jobTitle } : {}),
      },
    });

    const defaults = [
      {
        ownerId: userId,
        name: 'Assigned by Manager',
        slug: DefaultBoardListSlug.AssignedManager,
        position: 0,
        kind: ListKind.SYSTEM_ASSIGNED,
        isFixed: true,
        color: '#00b4d8',
      },
      {
        ownerId: userId,
        name: 'To Do',
        slug: DefaultBoardListSlug.Todo,
        position: 1,
        color: '#94a3b8',
      },
      {
        ownerId: userId,
        name: 'In Progress',
        slug: DefaultBoardListSlug.InProgress,
        position: 2,
        color: '#0ea5e9',
      },
      {
        ownerId: userId,
        name: 'Done',
        slug: DefaultBoardListSlug.Done,
        position: 3,
        color: '#22c55e',
      },
    ];

    await Promise.all(
      defaults.map((list) =>
        this.prisma.boardList.upsert({
          where: {
            ownerId_slug: {
              ownerId: list.ownerId,
              slug: list.slug,
            },
          },
          create: list,
          update: {
            name: list.name,
            position: list.position,
            color: list.color,
            isFixed: list.slug === DefaultBoardListSlug.AssignedManager,
            kind: list.slug === DefaultBoardListSlug.AssignedManager ? 'SYSTEM_ASSIGNED' : 'CUSTOM',
            deletedAt: null,
          },
        }),
      ),
    );
  }

  getStatusForListSlug(slug: string) {
    switch (slug) {
      case DefaultBoardListSlug.InProgress:
        return TaskStatus.IN_PROGRESS;
      case DefaultBoardListSlug.Done:
        return TaskStatus.DONE;
      default:
        return TaskStatus.TODO;
    }
  }

  async getAssignedList(userId: string) {
    return this.prisma.boardList.findFirst({
      where: {
        ownerId: userId,
        slug: DefaultBoardListSlug.AssignedManager,
        deletedAt: null,
      },
    });
  }

  async getFallbackTodoList(userId: string) {
    return this.prisma.boardList.findFirst({
      where: {
        ownerId: userId,
        slug: DefaultBoardListSlug.Todo,
        deletedAt: null,
      },
    });
  }
}
