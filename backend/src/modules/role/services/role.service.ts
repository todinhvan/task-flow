import { RoleCode } from '@/generated/prisma/enums';
import { ResponseApi } from '@/shared/interfaces/common/response.interface';
import { PrismaProvider } from '@/shared/providers/prisma.provider';
import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateRoleRequest, ListRolesQuery, UpdateRoleRequest } from '../dto/role.dto';

const ADMIN_ONLY_MESSAGE = 'Only administrators can perform this action';

@Injectable()
export class RoleService {
  constructor(private readonly prisma: PrismaProvider) {}

  async listRoles(query: ListRolesQuery, currentRoleCode: string) {
    this.ensureAdmin(currentRoleCode);

    const roles = await this.prisma.role.findMany({
      where: {
        ...(query.includeInactive ? {} : { deletedAt: null }),
        ...(query.search
          ? {
              OR: [
                { name: { contains: query.search, mode: 'insensitive' } },
                { description: { contains: query.search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: {
        permissions: {
          where: {
            deletedAt: null,
          },
          orderBy: [{ module: 'asc' }, { name: 'asc' }],
        },
        _count: {
          select: {
            users: {
              where: {
                deletedAt: null,
              },
            },
          },
        },
      },
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    });

    return ResponseApi.success({
      data: roles.map((role) => this.mapRole(role)),
    });
  }

  async getRoleById(id: string, currentRoleCode: string) {
    this.ensureAdmin(currentRoleCode);

    const role = await this.findRole(id);
    return ResponseApi.success({
      data: this.mapRole(role),
    });
  }

  async createRole(payload: CreateRoleRequest, currentRoleCode: string) {
    this.ensureAdmin(currentRoleCode);
    const permissions = await this.findPermissions(payload.permissionIds ?? []);

    const existing = await this.prisma.role.findUnique({
      where: { code: payload.code },
    });

    if (existing && !existing.deletedAt) {
      throw new BadRequestException('Role code already exists');
    }

    const nameOwner = await this.prisma.role.findFirst({
      where: {
        name: payload.name,
        deletedAt: null,
      },
    });
    if (nameOwner) {
      throw new BadRequestException('Role name already exists');
    }

    const role = existing
      ? await this.prisma.role.update({
          where: { id: existing.id },
          data: {
            name: payload.name,
            description: payload.description,
            isActive: payload.isActive ?? true,
            deletedAt: null,
            permissions: {
              set: permissions.map((permission) => ({ id: permission.id })),
            },
          },
          include: {
            permissions: true,
            _count: {
              select: {
                users: {
                  where: {
                    deletedAt: null,
                  },
                },
              },
            },
          },
        })
      : await this.prisma.role.create({
          data: {
            code: payload.code,
            name: payload.name,
            description: payload.description,
            isActive: payload.isActive ?? true,
            permissions: {
              connect: permissions.map((permission) => ({ id: permission.id })),
            },
          },
          include: {
            permissions: true,
            _count: {
              select: {
                users: {
                  where: {
                    deletedAt: null,
                  },
                },
              },
            },
          },
        });

    return ResponseApi.success({
      status: 201,
      message: 'Created',
      data: this.mapRole(role),
    });
  }

  async updateRole(id: string, payload: UpdateRoleRequest, currentRoleCode: string) {
    this.ensureAdmin(currentRoleCode);

    const existing = await this.findRole(id);
    const permissions = payload.permissionIds ? await this.findPermissions(payload.permissionIds) : null;

    if (payload.code && payload.code !== existing.code) {
      const codeOwner = await this.prisma.role.findUnique({
        where: { code: payload.code },
      });

      if (codeOwner && codeOwner.id !== existing.id && !codeOwner.deletedAt) {
        throw new BadRequestException('Role code already exists');
      }
    }

    if (payload.name && payload.name !== existing.name) {
      const nameOwner = await this.prisma.role.findFirst({
        where: {
          name: payload.name,
          deletedAt: null,
          id: {
            not: existing.id,
          },
        },
      });

      if (nameOwner) {
        throw new BadRequestException('Role name already exists');
      }
    }

    const role = await this.prisma.role.update({
      where: { id: existing.id },
      data: {
        ...(payload.code !== undefined ? { code: payload.code } : {}),
        ...(payload.name !== undefined ? { name: payload.name } : {}),
        ...(payload.description !== undefined ? { description: payload.description } : {}),
        ...(payload.isActive !== undefined ? { isActive: payload.isActive } : {}),
        ...(permissions
          ? {
              permissions: {
                set: permissions.map((permission) => ({ id: permission.id })),
              },
            }
          : {}),
      },
      include: {
        permissions: true,
        _count: {
          select: {
            users: {
              where: {
                deletedAt: null,
              },
            },
          },
        },
      },
    });

    return ResponseApi.success({
      data: this.mapRole(role),
    });
  }

  async deleteRole(id: string, currentRoleCode: string) {
    this.ensureAdmin(currentRoleCode);

    const role = await this.findRole(id);
    const activeUsers = await this.prisma.user.count({
      where: {
        roleId: role.id,
        deletedAt: null,
      },
    });

    if (activeUsers > 0) {
      throw new BadRequestException('Active users must be moved off this role before deletion');
    }

    await this.prisma.role.update({
      where: { id: role.id },
      data: {
        isActive: false,
        deletedAt: new Date(),
      },
    });

    return ResponseApi.success({
      data: true,
    });
  }

  private async findRole(id: string) {
    const role = await this.prisma.role.findFirst({
      where: {
        id,
        deletedAt: null,
      },
      include: {
        permissions: {
          where: {
            deletedAt: null,
          },
          orderBy: [{ module: 'asc' }, { name: 'asc' }],
        },
        _count: {
          select: {
            users: {
              where: {
                deletedAt: null,
              },
            },
          },
        },
      },
    });

    if (!role) {
      throw new NotFoundException('Role not found');
    }

    return role;
  }

  private async findPermissions(permissionIds: string[]) {
    if (permissionIds.length === 0) {
      return [];
    }

    const permissions = await this.prisma.permission.findMany({
      where: {
        id: {
          in: permissionIds,
        },
        deletedAt: null,
      },
    });

    if (permissions.length !== permissionIds.length) {
      throw new BadRequestException('One or more permissions are invalid');
    }

    return permissions;
  }

  private ensureAdmin(roleCode: string) {
    if (roleCode !== RoleCode.ADMIN) {
      throw new ForbiddenException(ADMIN_ONLY_MESSAGE);
    }
  }

  private mapRole(role: {
    id: string;
    code: RoleCode;
    name: string;
    description: string | null;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
    permissions: Array<{
      id: string;
      code: string;
      name: string;
      module: string;
      method: string;
      path: string;
    }>;
    _count?: {
      users: number;
    };
  }) {
    return {
      id: role.id,
      code: role.code,
      name: role.name,
      description: role.description,
      isActive: role.isActive,
      createdAt: role.createdAt,
      updatedAt: role.updatedAt,
      userCount: role._count?.users ?? 0,
      permissions: role.permissions.map((permission) => ({
        id: permission.id,
        code: permission.code,
        name: permission.name,
        module: permission.module,
        method: permission.method,
        path: permission.path,
      })),
    };
  }
}
