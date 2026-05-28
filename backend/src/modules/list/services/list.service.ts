import { ListKind, RoleCode, TaskSource } from '@/generated/prisma/enums';
import { ResponseApi } from '@/shared/interfaces/common/response.interface';
import { PrismaProvider } from '@/shared/providers/prisma.provider';
import { WorkspaceProvisionProvider } from '@/shared/providers/workspace-provision.provider';
import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateListRequest, ReorderListsRequest, UpdateListRequest } from '../dto/list.dto';

@Injectable()
export class ListService {
  constructor(
    private readonly prisma: PrismaProvider,
    private readonly workspaceProvisionProvider: WorkspaceProvisionProvider,
  ) {}

  async getMyLists(userId: string) {
    const lists = await this.prisma.boardList.findMany({
      where: {
        ownerId: userId,
        deletedAt: null,
      },
      include: {
        tasks: {
          where: {
            deletedAt: null,
            NOT: {
              source: TaskSource.MANAGER_ASSIGNED,
              assigneeDismissedAt: {
                not: null,
              },
            },
          },
          include: {
            attachments: true,
            assignee: {
              include: {
                profile: true,
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
          orderBy: {
            position: 'asc',
          },
        },
      },
      orderBy: {
        position: 'asc',
      },
    });

    return ResponseApi.success({
      data: lists.map((list) => ({
        id: list.id,
        name: list.name,
        slug: list.slug,
        color: list.color,
        description: list.description,
        kind: list.kind,
        isFixed: list.isFixed,
        position: list.position,
        tasks: list.tasks.map((task) => ({
          id: task.id,
          title: task.title,
          description: task.description,
          status: task.status,
          priority: task.priority,
          dueDate: task.dueDate,
          position: task.position,
          source: task.source,
          listId: task.listId,
          list: {
            id: list.id,
            name: list.name,
            slug: list.slug,
          },
          creator: {
            id: task.creator.id,
            fullName: task.creator.profile?.fullName ?? task.creator.email,
          },
          assignee: {
            id: task.assignee.id,
            fullName: task.assignee.profile?.fullName ?? task.assignee.email,
            avatarUrl: task.assignee.profile?.avatarUrl ?? null,
          },
          assignedBy: task.assignedById
            ? {
                id: task.assignedById,
                fullName: task.assignedBy?.profile?.fullName ?? task.assignedBy?.email ?? 'Manager',
              }
            : null,
          isLockedForAssignee: task.isLockedForAssignee,
          attachments: task.attachments,
          createdAt: task.createdAt,
          updatedAt: task.updatedAt,
          completedAt: task.completedAt,
        })),
      })),
    });
  }

  async createList(userId: string, payload: CreateListRequest) {
    const existingCount = await this.prisma.boardList.count({
      where: {
        ownerId: userId,
        deletedAt: null,
      },
    });

    const slug = await this.makeUniqueSlug(userId, payload.name);
    const list = await this.prisma.boardList.create({
      data: {
        ownerId: userId,
        name: payload.name,
        slug,
        description: payload.description,
        color: payload.color,
        position: existingCount,
      },
    });

    return ResponseApi.success({
      message: 'Created',
      status: 201,
      data: list,
    });
  }

  async updateList(userId: string, listId: string, payload: UpdateListRequest) {
    const list = await this.findOwnedList(userId, listId);
    if (list.isFixed) {
      throw new BadRequestException('Fixed lists cannot be edited');
    }

    const slug = payload.name ? await this.makeUniqueSlug(userId, payload.name, list.id) : undefined;
    const updated = await this.prisma.boardList.update({
      where: { id: list.id },
      data: {
        ...(payload.name !== undefined ? { name: payload.name } : {}),
        ...(slug ? { slug } : {}),
        ...(payload.description !== undefined ? { description: payload.description } : {}),
        ...(payload.color !== undefined ? { color: payload.color } : {}),
      },
    });

    return ResponseApi.success({
      data: updated,
    });
  }

  async reorderLists(userId: string, payload: ReorderListsRequest) {
    const lists = await this.prisma.boardList.findMany({
      where: {
        ownerId: userId,
        deletedAt: null,
      },
      select: {
        id: true,
      },
    });

    const validIds = new Set(lists.map((list) => list.id));
    if (
      payload.orderedListIds.length !== lists.length ||
      payload.orderedListIds.some((listId) => !validIds.has(listId))
    ) {
      throw new BadRequestException('Ordered list ids are invalid');
    }

    await this.prisma.$transaction(
      payload.orderedListIds.map((listId, index) =>
        this.prisma.boardList.update({
          where: { id: listId },
          data: { position: index },
        }),
      ),
    );

    return ResponseApi.success({
      data: true,
    });
  }

  async deleteList(userId: string, listId: string) {
    const list = await this.findOwnedList(userId, listId);
    if (list.isFixed || list.kind === ListKind.SYSTEM_ASSIGNED) {
      throw new BadRequestException('Fixed lists cannot be deleted');
    }

    const fallbackList = await this.workspaceProvisionProvider.getFallbackTodoList(userId);
    if (!fallbackList || fallbackList.id === list.id) {
      throw new BadRequestException('Fallback list is not available');
    }

    const tasks = await this.prisma.task.findMany({
      where: {
        listId: list.id,
        deletedAt: null,
      },
      orderBy: {
        position: 'asc',
      },
    });

    await this.prisma.$transaction([
      ...tasks.map((task, index) =>
        this.prisma.task.update({
          where: { id: task.id },
          data: {
            listId: fallbackList.id,
            position: index,
            status: this.workspaceProvisionProvider.getStatusForListSlug(fallbackList.slug) as any,
          },
        }),
      ),
      this.prisma.boardList.update({
        where: { id: list.id },
        data: {
          deletedAt: new Date(),
        },
      }),
    ]);

    return ResponseApi.success({
      data: true,
    });
  }

  private async findOwnedList(userId: string, listId: string) {
    const list = await this.prisma.boardList.findFirst({
      where: {
        id: listId,
        ownerId: userId,
        deletedAt: null,
      },
    });

    if (!list) {
      throw new NotFoundException('List not found');
    }

    return list;
  }

  private async makeUniqueSlug(userId: string, name: string, excludeId?: string) {
    const baseSlug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 90);

    let slug = baseSlug || `list-${Date.now()}`;
    let counter = 1;

    while (true) {
      const existing = await this.prisma.boardList.findFirst({
        where: {
          ownerId: userId,
          slug,
          ...(excludeId ? { id: { not: excludeId } } : {}),
        },
      });

      if (!existing) {
        return slug;
      }

      slug = `${baseSlug}-${counter++}`;
    }
  }
}
