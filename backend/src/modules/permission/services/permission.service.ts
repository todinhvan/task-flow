import { HttpMethod, RoleCode } from '@/generated/prisma/enums';
import { ResponseApi } from '@/shared/interfaces/common/response.interface';
import { PrismaProvider } from '@/shared/providers/prisma.provider';
import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  CreatePermissionRequest,
  ListPermissionsQuery,
  UpdatePermissionRequest,
} from '../dto/permission.dto';

const ADMIN_ONLY_MESSAGE = 'Only administrators can perform this action';

@Injectable()
export class PermissionService {
  constructor(private readonly prisma: PrismaProvider) {}

  async listPermissions(query: ListPermissionsQuery, currentRoleCode: string) {
    this.ensureAdmin(currentRoleCode);

    const permissions = await this.prisma.permission.findMany({
      where: {
        deletedAt: null,
        ...(query.module ? { module: query.module } : {}),
        ...(query.search
          ? {
              OR: [
                { code: { contains: query.search, mode: 'insensitive' } },
                { name: { contains: query.search, mode: 'insensitive' } },
                { path: { contains: query.search, mode: 'insensitive' } },
                { description: { contains: query.search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: {
        roles: {
          where: {
            deletedAt: null,
          },
          orderBy: {
            name: 'asc',
          },
        },
      },
      orderBy: [{ module: 'asc' }, { method: 'asc' }, { name: 'asc' }],
    });

    return ResponseApi.success({
      data: permissions.map((permission) => this.mapPermission(permission)),
    });
  }

  async getPermissionById(id: string, currentRoleCode: string) {
    this.ensureAdmin(currentRoleCode);

    const permission = await this.findPermission(id);
    return ResponseApi.success({
      data: this.mapPermission(permission),
    });
  }

  async createPermission(payload: CreatePermissionRequest, currentRoleCode: string) {
    this.ensureAdmin(currentRoleCode);
    const roles = await this.findRoles(payload.roleIds ?? []);

    const existing = await this.prisma.permission.findUnique({
      where: { code: payload.code },
    });

    if (existing && !existing.deletedAt) {
      throw new BadRequestException('Permission code already exists');
    }

    const permission = existing
      ? await this.prisma.permission.update({
          where: { id: existing.id },
          data: {
            name: payload.name,
            description: payload.description,
            path: payload.path,
            method: payload.method,
            module: payload.module,
            deletedAt: null,
            roles: {
              set: roles.map((role) => ({ id: role.id })),
            },
          },
          include: {
            roles: {
              where: {
                deletedAt: null,
              },
              orderBy: {
                name: 'asc',
              },
            },
          },
        })
      : await this.prisma.permission.create({
          data: {
            code: payload.code,
            name: payload.name,
            description: payload.description,
            path: payload.path,
            method: payload.method,
            module: payload.module,
            roles: {
              connect: roles.map((role) => ({ id: role.id })),
            },
          },
          include: {
            roles: {
              where: {
                deletedAt: null,
              },
              orderBy: {
                name: 'asc',
              },
            },
          },
        });

    return ResponseApi.success({
      status: 201,
      message: 'Created',
      data: this.mapPermission(permission),
    });
  }

  async updatePermission(id: string, payload: UpdatePermissionRequest, currentRoleCode: string) {
    this.ensureAdmin(currentRoleCode);

    const existing = await this.findPermission(id);
    const roles = payload.roleIds ? await this.findRoles(payload.roleIds) : null;

    if (payload.code && payload.code !== existing.code) {
      const codeOwner = await this.prisma.permission.findUnique({
        where: { code: payload.code },
      });

      if (codeOwner && codeOwner.id !== existing.id && !codeOwner.deletedAt) {
        throw new BadRequestException('Permission code already exists');
      }
    }

    const permission = await this.prisma.permission.update({
      where: { id: existing.id },
      data: {
        ...(payload.code !== undefined ? { code: payload.code } : {}),
        ...(payload.name !== undefined ? { name: payload.name } : {}),
        ...(payload.description !== undefined ? { description: payload.description } : {}),
        ...(payload.path !== undefined ? { path: payload.path } : {}),
        ...(payload.method !== undefined ? { method: payload.method } : {}),
        ...(payload.module !== undefined ? { module: payload.module } : {}),
        ...(roles
          ? {
              roles: {
                set: roles.map((role) => ({ id: role.id })),
              },
            }
          : {}),
      },
      include: {
        roles: {
          where: {
            deletedAt: null,
          },
          orderBy: {
            name: 'asc',
          },
        },
      },
    });

    return ResponseApi.success({
      data: this.mapPermission(permission),
    });
  }

  async deletePermission(id: string, currentRoleCode: string) {
    this.ensureAdmin(currentRoleCode);

    const permission = await this.findPermission(id);
    await this.prisma.permission.update({
      where: { id: permission.id },
      data: {
        deletedAt: new Date(),
        roles: {
          set: [],
        },
      },
    });

    return ResponseApi.success({
      data: true,
    });
  }

  private async findPermission(id: string) {
    const permission = await this.prisma.permission.findFirst({
      where: {
        id,
        deletedAt: null,
      },
      include: {
        roles: {
          where: {
            deletedAt: null,
          },
          orderBy: {
            name: 'asc',
          },
        },
      },
    });

    if (!permission) {
      throw new NotFoundException('Permission not found');
    }

    return permission;
  }

  private async findRoles(roleIds: string[]) {
    if (roleIds.length === 0) {
      return [];
    }

    const roles = await this.prisma.role.findMany({
      where: {
        id: {
          in: roleIds,
        },
        deletedAt: null,
      },
    });

    if (roles.length !== roleIds.length) {
      throw new BadRequestException('One or more roles are invalid');
    }

    return roles;
  }

  private ensureAdmin(roleCode: string) {
    if (roleCode !== RoleCode.ADMIN) {
      throw new ForbiddenException(ADMIN_ONLY_MESSAGE);
    }
  }

  private mapPermission(permission: Awaited<ReturnType<PermissionService['findPermission']>>) {
    return {
      id: permission.id,
      code: permission.code,
      name: permission.name,
      description: permission.description,
      path: permission.path,
      method: permission.method as HttpMethod,
      module: permission.module,
      createdAt: permission.createdAt,
      updatedAt: permission.updatedAt,
      roles: permission.roles.map((role) => ({
        id: role.id,
        code: role.code,
        name: role.name,
        isActive: role.isActive,
      })),
    };
  }
}
