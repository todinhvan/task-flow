import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { HttpMethod, RoleCode } from '@/generated/prisma/enums';
import { PermissionService } from './permission.service';

describe('PermissionService', () => {
  const prisma = {
    permission: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    role: {
      findMany: jest.fn(),
    },
  };
  const service = new PermissionService(prisma as any);

  const roleRecord = {
    id: 'role-1',
    code: RoleCode.MANAGER,
    name: 'Manager',
    isActive: true,
  };

  const permissionRecord = {
    id: 'permission-1',
    code: 'user:read',
    name: 'Read Users',
    description: 'Read users',
    path: '/users',
    method: HttpMethod.GET,
    module: 'Users',
    createdAt: new Date(),
    updatedAt: new Date(),
    roles: [roleRecord],
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('lists permissions for administrators on the happy path', async () => {
    prisma.permission.findMany.mockResolvedValue([permissionRecord]);

    const result = await service.listPermissions({}, RoleCode.ADMIN);

    expect(result.data).toHaveLength(1);
    expect(result.data?.[0].roles[0].code).toBe(RoleCode.MANAGER);
  });

  it('rejects non-admin permission access', async () => {
    await expect(service.listPermissions({}, RoleCode.EMPLOYEE)).rejects.toThrow(ForbiddenException);
  });

  it('gets a permission by id on the happy path', async () => {
    prisma.permission.findFirst.mockResolvedValue(permissionRecord);

    const result = await service.getPermissionById('permission-1', RoleCode.ADMIN);

    expect(result.data?.id).toBe('permission-1');
  });

  it('creates a permission on the happy path', async () => {
    prisma.role.findMany.mockResolvedValue([roleRecord]);
    prisma.permission.findUnique.mockResolvedValue(null);
    prisma.permission.create.mockResolvedValue(permissionRecord);

    const result = await service.createPermission(
      {
        code: 'user:read',
        name: 'Read Users',
        description: 'Read users',
        path: '/users',
        method: HttpMethod.GET,
        module: 'Users',
        roleIds: ['role-1'],
      },
      RoleCode.ADMIN,
    );

    expect(result.status).toBe(201);
  });

  it('restores a soft-deleted permission on the happy path', async () => {
    prisma.role.findMany.mockResolvedValue([]);
    prisma.permission.findUnique.mockResolvedValue({ id: 'permission-1', deletedAt: new Date() });
    prisma.permission.update.mockResolvedValue(permissionRecord);

    const result = await service.createPermission(
      {
        code: 'user:read',
        name: 'Read Users',
        path: '/users',
        method: HttpMethod.GET,
        module: 'Users',
        roleIds: [],
      },
      RoleCode.ADMIN,
    );

    expect(prisma.permission.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'permission-1' },
      }),
    );
    expect(result.status).toBe(201);
  });

  it('rejects invalid role ids during permission creation', async () => {
    prisma.role.findMany.mockResolvedValue([]);

    await expect(
      service.createPermission(
        {
          code: 'user:read',
          name: 'Read Users',
          description: 'Read users',
          path: '/users',
          method: HttpMethod.GET,
          module: 'Users',
          roleIds: ['missing-role'],
        },
        RoleCode.ADMIN,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('updates a permission on the happy path', async () => {
    prisma.permission.findFirst.mockResolvedValue(permissionRecord);
    prisma.role.findMany.mockResolvedValue([roleRecord]);
    prisma.permission.findUnique.mockResolvedValue(null);
    prisma.permission.update.mockResolvedValue({
      ...permissionRecord,
      name: 'View Users',
    });

    const result = await service.updatePermission(
      'permission-1',
      {
        name: 'View Users',
        roleIds: ['role-1'],
      },
      RoleCode.ADMIN,
    );

    expect(result.data?.name).toBe('View Users');
  });

  it('rejects duplicate permission codes during update', async () => {
    prisma.permission.findFirst.mockResolvedValue(permissionRecord);
    prisma.permission.findUnique.mockResolvedValue({ id: 'permission-2', deletedAt: null });

    await expect(
      service.updatePermission(
        'permission-1',
        {
          code: 'duplicate:code',
        },
        RoleCode.ADMIN,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('deletes a permission on the happy path', async () => {
    prisma.permission.findFirst.mockResolvedValue(permissionRecord);
    prisma.permission.update.mockResolvedValue(undefined);

    const result = await service.deletePermission('permission-1', RoleCode.ADMIN);

    expect(result.data).toBe(true);
  });

  it('throws when the permission does not exist', async () => {
    prisma.permission.findFirst.mockResolvedValue(null);

    await expect(service.getPermissionById('missing', RoleCode.ADMIN)).rejects.toThrow(NotFoundException);
  });
});
