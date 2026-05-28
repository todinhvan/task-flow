import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { RoleCode, UserStatus } from '@/generated/prisma/enums';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  const prisma = {
    role: { findUnique: jest.fn() },
    user: { create: jest.fn() },
  };
  const userRepository = { findActiveByEmail: jest.fn() };
  const userService = { getSessionUser: jest.fn() };
  const hashingProvider = { hash: jest.fn(), compare: jest.fn() };
  const tokenProvider = {
    generateAccessToken: jest.fn(),
    generateRefreshToken: jest.fn(),
    consumeRefreshToken: jest.fn(),
    revokeRefreshToken: jest.fn(),
  };
  const workspaceProvisionProvider = { provisionForUser: jest.fn() };
  const captchaProvider = { verifyOrThrow: jest.fn() };

  const service = new AuthService(
    prisma as any,
    userRepository as any,
    userService as any,
    hashingProvider as any,
    tokenProvider as any,
    workspaceProvisionProvider as any,
    captchaProvider as any,
  );

  const sessionUser = {
    id: 'user-1',
    email: 'employee@taskflow.local',
    status: UserStatus.ACTIVE,
    role: {
      id: 'role-employee',
      code: RoleCode.EMPLOYEE,
      name: 'Employee',
    },
    profile: {
      id: 'profile-1',
      fullName: 'Employee One',
      phoneNumber: null,
      jobTitle: null,
      department: null,
      bio: null,
      location: null,
      dateOfBirth: null,
      avatarUrl: null,
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.role.findUnique.mockResolvedValue({ id: 'role-employee' });
    prisma.user.create.mockResolvedValue({ id: 'user-1' });
    hashingProvider.hash.mockResolvedValue('hashed-password');
    hashingProvider.compare.mockResolvedValue(true);
    tokenProvider.generateAccessToken.mockResolvedValue('access-token');
    tokenProvider.generateRefreshToken.mockResolvedValue('refresh-token');
    tokenProvider.consumeRefreshToken.mockResolvedValue({ userId: 'user-1' });
    tokenProvider.revokeRefreshToken.mockResolvedValue(undefined);
    workspaceProvisionProvider.provisionForUser.mockResolvedValue(undefined);
    userService.getSessionUser.mockResolvedValue(sessionUser);
    captchaProvider.verifyOrThrow.mockResolvedValue(undefined);
  });

  it('registers a new employee account on the happy path', async () => {
    userRepository.findActiveByEmail.mockResolvedValue(null);

    const result = await service.register(
      {
        fullName: 'Employee One',
        email: 'employee@taskflow.local',
        password: 'Taskflow@123',
        confirmPassword: 'Taskflow@123',
        captchaToken: 'captcha',
      },
      '127.0.0.1',
    );

    expect(captchaProvider.verifyOrThrow).toHaveBeenCalledWith('captcha', '127.0.0.1');
    expect(workspaceProvisionProvider.provisionForUser).toHaveBeenCalledWith({
      userId: 'user-1',
      fullName: 'Employee One',
    });
    expect(result.data?.accessToken).toBe('access-token');
    expect(result.data?.refreshToken).toBe('refresh-token');
  });

  it('rejects duplicate registration emails', async () => {
    userRepository.findActiveByEmail.mockResolvedValue({ id: 'existing-user' });

    await expect(
      service.register({
        fullName: 'Employee One',
        email: 'employee@taskflow.local',
        password: 'Taskflow@123',
        confirmPassword: 'Taskflow@123',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects registration when the employee role is unavailable', async () => {
    userRepository.findActiveByEmail.mockResolvedValue(null);
    prisma.role.findUnique.mockResolvedValue(null);

    await expect(
      service.register({
        fullName: 'Employee One',
        email: 'employee@taskflow.local',
        password: 'Taskflow@123',
        confirmPassword: 'Taskflow@123',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('logs in an active user on the happy path', async () => {
    userRepository.findActiveByEmail.mockResolvedValue({
      id: 'user-1',
      email: 'employee@taskflow.local',
      password: 'hashed-password',
      status: UserStatus.ACTIVE,
    });

    const result = await service.login({
      email: 'employee@taskflow.local',
      password: 'Taskflow@123',
      captchaToken: 'captcha',
    });

    expect(hashingProvider.compare).toHaveBeenCalledWith('Taskflow@123', 'hashed-password');
    expect(result.data?.user.email).toBe('employee@taskflow.local');
  });

  it('rejects inactive users during login', async () => {
    userRepository.findActiveByEmail.mockResolvedValue({
      id: 'user-1',
      email: 'employee@taskflow.local',
      password: 'hashed-password',
      status: UserStatus.BLOCKED,
    });

    await expect(
      service.login({
        email: 'employee@taskflow.local',
        password: 'Taskflow@123',
      }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects invalid passwords during login', async () => {
    userRepository.findActiveByEmail.mockResolvedValue({
      id: 'user-1',
      email: 'employee@taskflow.local',
      password: 'hashed-password',
      status: UserStatus.ACTIVE,
    });
    hashingProvider.compare.mockResolvedValue(false);

    await expect(
      service.login({
        email: 'employee@taskflow.local',
        password: 'Taskflow@123',
      }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('refreshes a session by consuming the refresh token', async () => {
    const result = await service.refresh({
      refreshToken: 'refresh-token',
    });

    expect(tokenProvider.consumeRefreshToken).toHaveBeenCalledWith('refresh-token');
    expect(result.data?.accessToken).toBe('access-token');
  });

  it('revokes refresh tokens during logout', async () => {
    const result = await service.logout({
      refreshToken: 'refresh-token',
    });

    expect(tokenProvider.revokeRefreshToken).toHaveBeenCalledWith('refresh-token');
    expect(result.data).toBe(true);
  });

  it('returns the session user for /me on the happy path', async () => {
    const result = await service.me('user-1');

    expect(result.data?.id).toBe('user-1');
  });

  it('rejects auth response building when the session user cannot be loaded', async () => {
    userRepository.findActiveByEmail.mockResolvedValue({
      id: 'user-1',
      email: 'employee@taskflow.local',
      password: 'hashed-password',
      status: UserStatus.ACTIVE,
    });
    userService.getSessionUser.mockResolvedValue(null);

    await expect(
      service.login({
        email: 'employee@taskflow.local',
        password: 'Taskflow@123',
      }),
    ).rejects.toThrow(UnauthorizedException);
  });
});
