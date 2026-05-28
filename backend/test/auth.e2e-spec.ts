import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';

jest.mock('uuid', () => ({
  v4: () => 'test-uuid',
}));

import { AuthController } from '@/modules/auth/controllers/auth.controller';
import { AuthService } from '@/modules/auth/services/auth.service';
import { UserRepository } from '@/modules/user/repositories/user.repository';
import { UserService } from '@/modules/user/services/user.service';
import { CaptchaProvider } from '@/shared/providers/captcha.provider';
import { HashingProvider } from '@/shared/providers/hashing.provider';
import { PrismaProvider } from '@/shared/providers/prisma.provider';
import { TokenProvider } from '@/shared/providers/token.provider';
import { WorkspaceProvisionProvider } from '@/shared/providers/workspace-provision.provider';
import { RoleCode, UserStatus } from '@/generated/prisma/enums';

describe('AuthController (e2e)', () => {
  let app: INestApplication;

  const captchaProvider = {
    verifyOrThrow: jest.fn(),
  };

  const prismaProvider = {
    role: {
      findUnique: jest.fn(),
    },
    user: {
      create: jest.fn(),
    },
  };

  const userRepository = {
    findActiveByEmail: jest.fn(),
  };

  const userService = {
    getSessionUser: jest.fn(),
  };

  const hashingProvider = {
    hash: jest.fn(),
    compare: jest.fn(),
  };

  const tokenProvider = {
    generateAccessToken: jest.fn(),
    generateRefreshToken: jest.fn(),
    consumeRefreshToken: jest.fn(),
    revokeRefreshToken: jest.fn(),
  };

  const workspaceProvisionProvider = {
    provisionForUser: jest.fn(),
  };

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

  beforeEach(async () => {
    jest.clearAllMocks();

    prismaProvider.role.findUnique.mockResolvedValue({
      id: 'role-employee',
      code: RoleCode.EMPLOYEE,
    });
    prismaProvider.user.create.mockResolvedValue({
      id: 'user-1',
    });
    hashingProvider.hash.mockResolvedValue('hashed-password');
    hashingProvider.compare.mockResolvedValue(true);
    tokenProvider.generateAccessToken.mockResolvedValue('access-token');
    tokenProvider.generateRefreshToken.mockResolvedValue('rotated-refresh-token');
    tokenProvider.consumeRefreshToken.mockResolvedValue({
      userId: 'user-1',
    });
    tokenProvider.revokeRefreshToken.mockResolvedValue(undefined);
    workspaceProvisionProvider.provisionForUser.mockResolvedValue(undefined);
    userService.getSessionUser.mockResolvedValue(sessionUser);

    const moduleRef = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        AuthService,
        {
          provide: PrismaProvider,
          useValue: prismaProvider,
        },
        {
          provide: UserRepository,
          useValue: userRepository,
        },
        {
          provide: UserService,
          useValue: userService,
        },
        {
          provide: HashingProvider,
          useValue: hashingProvider,
        },
        {
          provide: TokenProvider,
          useValue: tokenProvider,
        },
        {
          provide: WorkspaceProvisionProvider,
          useValue: workspaceProvisionProvider,
        },
        {
          provide: CaptchaProvider,
          useValue: captchaProvider,
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('rejects register when captcha enforcement fails', async () => {
    captchaProvider.verifyOrThrow.mockRejectedValueOnce(new BadRequestException('Captcha token is required'));

    await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        fullName: 'Employee One',
        email: 'employee@taskflow.local',
        password: 'Taskflow@123',
        confirmPassword: 'Taskflow@123',
      })
      .expect(400);
  });

  it('allows login with a verified captcha token', async () => {
    captchaProvider.verifyOrThrow.mockResolvedValueOnce(undefined);
    userRepository.findActiveByEmail.mockResolvedValueOnce({
      id: 'user-1',
      email: 'employee@taskflow.local',
      password: 'hashed-password',
      status: UserStatus.ACTIVE,
    });

    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'employee@taskflow.local',
        password: 'Taskflow@123',
        captchaToken: 'valid-captcha-token',
      })
      .expect(201);

    expect(response.body.data.accessToken).toBe('access-token');
    expect(response.body.data.refreshToken).toBe('rotated-refresh-token');
    expect(captchaProvider.verifyOrThrow).toHaveBeenCalledWith('valid-captcha-token', expect.any(String));
  });

  it('allows register when captcha is disabled upstream', async () => {
    captchaProvider.verifyOrThrow.mockResolvedValueOnce(undefined);
    userRepository.findActiveByEmail.mockResolvedValueOnce(null);

    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        fullName: 'Employee One',
        email: 'employee@taskflow.local',
        password: 'Taskflow@123',
        confirmPassword: 'Taskflow@123',
      })
      .expect(201);

    expect(response.body.data.accessToken).toBe('access-token');
    expect(captchaProvider.verifyOrThrow).toHaveBeenCalledWith(undefined, expect.any(String));
  });

  it('rotates refresh tokens via /auth/refresh', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({
        refreshToken: 'refresh-token',
      })
      .expect(201);

    expect(tokenProvider.consumeRefreshToken).toHaveBeenCalledWith('refresh-token');
    expect(response.body.data.refreshToken).toBe('rotated-refresh-token');
  });

  it('revokes refresh tokens via /auth/logout', async () => {
    await request(app.getHttpServer())
      .post('/auth/logout')
      .send({
        refreshToken: 'refresh-token',
      })
      .expect(201);

    expect(tokenProvider.revokeRefreshToken).toHaveBeenCalledWith('refresh-token');
  });
});
