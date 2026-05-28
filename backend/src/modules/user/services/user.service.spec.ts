import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { RoleCode } from '@/generated/prisma/enums';
import { UserService } from './user.service';

describe('UserService', () => {
  const prisma = {
    role: { findUnique: jest.fn() },
    user: { create: jest.fn(), update: jest.fn(), findMany: jest.fn() },
    userProfile: { update: jest.fn() },
    refreshToken: { deleteMany: jest.fn() },
    $transaction: jest.fn(),
  };
  const userRepository = {
    findMany: jest.fn(),
    findActiveById: jest.fn(),
    findActiveByEmail: jest.fn(),
  };
  const hashingProvider = { hash: jest.fn() };
  const workspaceProvisionProvider = { provisionForUser: jest.fn() };
  const cloudinaryProvider = { uploadBuffer: jest.fn(), destroy: jest.fn() };

  const service = new UserService(
    prisma as any,
    userRepository as any,
    hashingProvider as any,
    workspaceProvisionProvider as any,
    cloudinaryProvider as any,
  );

  const existingUser = {
    id: 'user-1',
    email: 'user@example.com',
    status: 'ACTIVE',
    role: { id: 'role-1', code: RoleCode.EMPLOYEE, name: 'Employee' },
    profile: {
      id: 'profile-1',
      fullName: 'User One',
      phoneNumber: null,
      jobTitle: 'Developer',
      department: null,
      bio: null,
      location: null,
      dateOfBirth: null,
      avatarUrl: null,
      avatarPublicId: null,
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation(async (operations: unknown[]) => operations);
    hashingProvider.hash.mockResolvedValue('hashed-password');
    workspaceProvisionProvider.provisionForUser.mockResolvedValue(undefined);
    prisma.userProfile.update.mockResolvedValue(undefined);
    cloudinaryProvider.uploadBuffer.mockResolvedValue({
      secure_url: 'https://cdn.example/avatar.webp',
      public_id: 'avatar-public-id',
    });
  });

  it('lists users for administrators on the happy path', async () => {
    userRepository.findMany.mockResolvedValue([existingUser]);

    const result = await service.listUsers({}, RoleCode.ADMIN);

    expect(result.data).toHaveLength(1);
    expect(result.data?.[0]?.email).toBe('user@example.com');
  });

  it('rejects non-admin list access', async () => {
    await expect(service.listUsers({}, RoleCode.EMPLOYEE)).rejects.toThrow(ForbiddenException);
  });

  it('gets a user by id on the happy path', async () => {
    userRepository.findActiveById.mockResolvedValue(existingUser);

    const result = await service.getUserById('user-1', RoleCode.ADMIN);

    expect(result.data?.id).toBe('user-1');
  });

  it('returns employees for admins and managers on the happy path', async () => {
    prisma.user.findMany.mockResolvedValue([existingUser]);

    const result = await service.getEmployees(RoleCode.MANAGER);

    expect(result.data?.[0].fullName).toBe('User One');
  });

  it('rejects employee access to the employee directory', async () => {
    await expect(service.getEmployees(RoleCode.EMPLOYEE)).rejects.toThrow(ForbiddenException);
  });

  it('creates a user on the happy path', async () => {
    prisma.role.findUnique.mockResolvedValue({ id: 'role-employee' });
    userRepository.findActiveByEmail.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({ id: 'user-1', role: {}, profile: {} });
    userRepository.findActiveById.mockResolvedValue(existingUser);

    const result = await service.createUser(
      {
        email: 'user@example.com',
        password: 'Taskflow@123',
        roleCode: RoleCode.EMPLOYEE,
        fullName: 'User One',
      },
      undefined,
      RoleCode.ADMIN,
    );

    expect(result.status).toBe(201);
    expect(workspaceProvisionProvider.provisionForUser).toHaveBeenCalled();
  });

  it('creates a user with avatar upload on the happy path', async () => {
    prisma.role.findUnique.mockResolvedValue({ id: 'role-employee' });
    userRepository.findActiveByEmail.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({ id: 'user-1', role: {}, profile: {} });
    userRepository.findActiveById.mockResolvedValue(existingUser);

    await service.createUser(
      {
        email: 'user@example.com',
        password: 'Taskflow@123',
        roleCode: RoleCode.EMPLOYEE,
        fullName: 'User One',
      },
      {
        buffer: Buffer.from('avatar'),
        originalname: 'avatar.png',
        mimetype: 'image/png',
        size: 128,
      } as Express.Multer.File,
      RoleCode.ADMIN,
    );

    expect(cloudinaryProvider.uploadBuffer).toHaveBeenCalled();
    expect(prisma.userProfile.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          avatarUrl: 'https://cdn.example/avatar.webp',
        }),
      }),
    );
  });

  it('rejects user creation when the role does not exist', async () => {
    prisma.role.findUnique.mockResolvedValue(null);

    await expect(
      service.createUser(
        {
          email: 'user@example.com',
          password: 'Taskflow@123',
          roleCode: RoleCode.EMPLOYEE,
          fullName: 'User One',
        },
        undefined,
        RoleCode.ADMIN,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects duplicate emails during creation', async () => {
    prisma.role.findUnique.mockResolvedValue({ id: 'role-employee' });
    userRepository.findActiveByEmail.mockResolvedValue(existingUser);

    await expect(
      service.createUser(
        {
          email: 'user@example.com',
          password: 'Taskflow@123',
          roleCode: RoleCode.EMPLOYEE,
          fullName: 'User One',
        },
        undefined,
        RoleCode.ADMIN,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('updates a user on the happy path', async () => {
    userRepository.findActiveById.mockResolvedValueOnce(existingUser).mockResolvedValueOnce({
      ...existingUser,
      email: 'updated@example.com',
      profile: {
        ...existingUser.profile,
        fullName: 'Updated User',
      },
    });
    prisma.user.update.mockResolvedValue(undefined);

    const result = await service.updateUser(
      'user-1',
      {
        fullName: 'Updated User',
        email: 'updated@example.com',
      },
      undefined,
      RoleCode.ADMIN,
      'admin-user',
    );

    expect(result.data?.profile.fullName).toBe('Updated User');
  });

  it('updates role, password, and avatar on the happy path', async () => {
    userRepository.findActiveById
      .mockResolvedValueOnce({
        ...existingUser,
        profile: {
          ...existingUser.profile,
          avatarPublicId: 'old-avatar',
        },
      })
      .mockResolvedValueOnce({
        ...existingUser,
        role: { id: 'role-manager', code: RoleCode.MANAGER, name: 'Manager' },
      });
    prisma.role.findUnique.mockResolvedValueOnce({ id: 'role-manager' }).mockResolvedValueOnce({ id: 'role-manager' });
    prisma.user.update.mockResolvedValue(undefined);

    await service.updateUser(
      'user-1',
      {
        password: 'Taskflow@456',
        roleCode: RoleCode.MANAGER,
      },
      {
        buffer: Buffer.from('avatar'),
        originalname: 'avatar.png',
        mimetype: 'image/png',
        size: 256,
      } as Express.Multer.File,
      RoleCode.ADMIN,
      'admin-user',
    );

    expect(cloudinaryProvider.destroy).toHaveBeenCalledWith('old-avatar', 'image');
    expect(hashingProvider.hash).toHaveBeenCalledWith('Taskflow@456');
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          roleId: 'role-manager',
          password: 'hashed-password',
        }),
      }),
    );
  });

  it('rejects blocking the current account', async () => {
    userRepository.findActiveById.mockResolvedValue(existingUser);

    await expect(
      service.updateUser(
        'user-1',
        {
          status: 'BLOCKED' as any,
        },
        undefined,
        RoleCode.ADMIN,
        'user-1',
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects duplicate emails during update', async () => {
    userRepository.findActiveById.mockResolvedValue(existingUser);
    userRepository.findActiveByEmail.mockResolvedValue({ id: 'user-2' });

    await expect(
      service.updateUser(
        'user-1',
        {
          email: 'duplicate@example.com',
        },
        undefined,
        RoleCode.ADMIN,
        'admin-user',
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects update when the target role does not exist', async () => {
    userRepository.findActiveById.mockResolvedValue(existingUser);
    prisma.role.findUnique.mockResolvedValue(null);

    await expect(
      service.updateUser(
        'user-1',
        {
          roleCode: RoleCode.MANAGER,
        },
        undefined,
        RoleCode.ADMIN,
        'admin-user',
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects deleting the current account', async () => {
    await expect(service.deleteUser('user-1', RoleCode.ADMIN, 'user-1')).rejects.toThrow(BadRequestException);
  });

  it('throws when deleting a missing user', async () => {
    userRepository.findActiveById.mockResolvedValue(null);

    await expect(service.deleteUser('missing', RoleCode.ADMIN, 'admin-user')).rejects.toThrow(NotFoundException);
  });

  it('deletes a user on the happy path', async () => {
    userRepository.findActiveById.mockResolvedValue(existingUser);
    prisma.refreshToken.deleteMany.mockResolvedValue(undefined);
    prisma.user.update.mockResolvedValue(undefined);

    const result = await service.deleteUser('user-1', RoleCode.ADMIN, 'admin-user');

    expect(prisma.$transaction).toHaveBeenCalled();
    expect(result.data).toBe(true);
  });

  it('returns the current session user on the happy path', async () => {
    userRepository.findActiveById.mockResolvedValue(existingUser);

    const result = await service.getSessionUser('user-1');

    expect(result?.profile.fullName).toBe('User One');
  });

  it('throws when the session user cannot be found', async () => {
    userRepository.findActiveById.mockResolvedValue(null);

    await expect(service.getSessionUser('missing')).rejects.toThrow(NotFoundException);
  });
});
