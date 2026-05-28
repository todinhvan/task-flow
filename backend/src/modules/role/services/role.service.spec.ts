import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { RoleCode } from '@/generated/prisma/enums';
import { RoleService } from './role.service';

describe('RoleService', () => {
  const prisma = {
    role: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    permission: {
      findMany: jest.fn(),
    },
    user: {
      count: jest.fn(),
    },
  };
  const service = new RoleService(prisma as any);

  const permissionRecord = {
    id: 'permission-1',
    code: 'task:read',
    name: 'Read Tasks',
    module: 'Tasks',
    method: 'GET',
    path: '/tasks',
  };

  const roleRecord = {
    id: 'role-1',
    code: RoleCode.MANAGER,
    name: 'Manager',
    description: 'Role description',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    permissions: [permissionRecord],
    _count: { users: 0 },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns roles for administrators on the happy path', async () => {
    prisma.role.findMany.mockResolvedValue([roleRecord]);

    const result = await service.listRoles({}, RoleCode.ADMIN);

    expect(result.data).toHaveLength(1);
    expect(result.data?.[0].permissions[0].code).toBe('task:read');
  });

  it('rejects non-admin role access', async () => {
    await expect(service.listRoles({}, RoleCode.EMPLOYEE)).rejects.toThrow(ForbiddenException);
  });

  it('gets a role by id on the happy path', async () => {
    prisma.role.findFirst.mockResolvedValue(roleRecord);

    const result = await service.getRoleById('role-1', RoleCode.ADMIN);

    expect(result.data?.id).toBe('role-1');
  });

  it('creates a new role on the happy path', async () => {
    prisma.permission.findMany.mockResolvedValue([permissionRecord]);
    prisma.role.findUnique.mockResolvedValue(null);
    prisma.role.findFirst.mockResolvedValue(null);
    prisma.role.create.mockResolvedValue(roleRecord);

    const result = await service.createRole(
      {
        code: RoleCode.MANAGER,
        name: 'Manager',
        description: 'Role description',
        permissionIds: ['permission-1'],
      },
      RoleCode.ADMIN,
    );

    expect(result.status).toBe(201);
    expect(prisma.role.create).toHaveBeenCalled();
  });

  it('restores a previously soft-deleted role on the happy path', async () => {
    prisma.permission.findMany.mockResolvedValue([]);
    prisma.role.findUnique.mockResolvedValue({ id: 'role-1', deletedAt: new Date() });
    prisma.role.findFirst.mockResolvedValue(null);
    prisma.role.update.mockResolvedValue(roleRecord);

    const result = await service.createRole(
      {
        code: RoleCode.MANAGER,
        name: 'Manager',
        permissionIds: [],
      },
      RoleCode.ADMIN,
    );

    expect(prisma.role.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'role-1' },
      }),
    );
    expect(result.status).toBe(201);
  });

  it('rejects duplicate role codes', async () => {
    prisma.permission.findMany.mockResolvedValue([]);
    prisma.role.findUnique.mockResolvedValue({ id: 'role-1', deletedAt: null });

    await expect(
      service.createRole(
        {
          code: RoleCode.MANAGER,
          name: 'Manager',
          description: 'Role description',
          permissionIds: [],
        },
        RoleCode.ADMIN,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects invalid permission ids during creation', async () => {
    prisma.permission.findMany.mockResolvedValue([]);

    await expect(
      service.createRole(
        {
          code: RoleCode.MANAGER,
          name: 'Manager',
          permissionIds: ['missing-permission'],
        },
        RoleCode.ADMIN,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('updates a role on the happy path', async () => {
    prisma.role.findFirst.mockResolvedValueOnce(roleRecord).mockResolvedValueOnce(null);
    prisma.permission.findMany.mockResolvedValue([permissionRecord]);
    prisma.role.findUnique.mockResolvedValue(null);
    prisma.role.update.mockResolvedValue({
      ...roleRecord,
      name: 'Operations Manager',
    });

    const result = await service.updateRole(
      'role-1',
      {
        name: 'Operations Manager',
        permissionIds: ['permission-1'],
      },
      RoleCode.ADMIN,
    );

    expect(result.data?.name).toBe('Operations Manager');
  });

  it('rejects duplicate role names during update', async () => {
    prisma.role.findFirst.mockResolvedValueOnce(roleRecord).mockResolvedValueOnce({
      id: 'role-2',
      name: 'Operations Manager',
    });

    await expect(
      service.updateRole(
        'role-1',
        {
          name: 'Operations Manager',
        },
        RoleCode.ADMIN,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects deleting roles that still have active users', async () => {
    prisma.role.findFirst.mockResolvedValue(roleRecord);
    prisma.user.count.mockResolvedValue(2);

    await expect(service.deleteRole('role-1', RoleCode.ADMIN)).rejects.toThrow(BadRequestException);
  });

  it('deletes a role on the happy path', async () => {
    prisma.role.findFirst.mockResolvedValue(roleRecord);
    prisma.user.count.mockResolvedValue(0);
    prisma.role.update.mockResolvedValue(undefined);

    const result = await service.deleteRole('role-1', RoleCode.ADMIN);

    expect(result.data).toBe(true);
  });

  it('throws when the role does not exist', async () => {
    prisma.role.findFirst.mockResolvedValue(null);

    await expect(service.getRoleById('missing', RoleCode.ADMIN)).rejects.toThrow(NotFoundException);
  });
});
