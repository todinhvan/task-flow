import { RoleCode, UserStatus } from '@/generated/prisma/enums';
import { ResponseApi } from '@/shared/interfaces/common/response.interface';
import { LoginRequest, LogoutRequest, RefreshRequest, RegisterRequest } from '@/shared/interfaces/auth/auth-request.interface';
import { CaptchaProvider } from '@/shared/providers/captcha.provider';
import { HashingProvider } from '@/shared/providers/hashing.provider';
import { PrismaProvider } from '@/shared/providers/prisma.provider';
import { TokenProvider } from '@/shared/providers/token.provider';
import { WorkspaceProvisionProvider } from '@/shared/providers/workspace-provision.provider';
import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { UserRepository } from '@/modules/user/repositories/user.repository';
import { UserService } from '@/modules/user/services/user.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaProvider,
    private readonly userRepository: UserRepository,
    private readonly userService: UserService,
    private readonly hashingProvider: HashingProvider,
    private readonly tokenProvider: TokenProvider,
    private readonly workspaceProvisionProvider: WorkspaceProvisionProvider,
    private readonly captchaProvider: CaptchaProvider,
  ) {}

  async register(payload: RegisterRequest, ipAddress?: string) {
    await this.captchaProvider.verifyOrThrow(payload.captchaToken, ipAddress);

    const existingUser = await this.userRepository.findActiveByEmail(payload.email);
    if (existingUser) {
      throw new BadRequestException('Email is already in use');
    }

    const employeeRole = await this.prisma.role.findUnique({
      where: {
        code: RoleCode.EMPLOYEE,
      },
    });

    if (!employeeRole) {
      throw new BadRequestException('Employee role is not available');
    }

    const hashedPassword = await this.hashingProvider.hash(payload.password);
    const user = await this.prisma.user.create({
      data: {
        email: payload.email,
        password: hashedPassword,
        roleId: employeeRole.id,
      },
    });

    await this.workspaceProvisionProvider.provisionForUser({
      userId: user.id,
      fullName: payload.fullName,
    });

    return this.buildAuthResponse(user.id);
  }

  async login(payload: LoginRequest, ipAddress?: string) {
    await this.captchaProvider.verifyOrThrow(payload.captchaToken, ipAddress);

    const user = await this.userRepository.findActiveByEmail(payload.email);
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('Your account is not active');
    }

    const isPasswordValid = await this.hashingProvider.compare(payload.password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return this.buildAuthResponse(user.id);
  }

  async refresh(payload: RefreshRequest) {
    const refreshTokenPayload = await this.tokenProvider.consumeRefreshToken(payload.refreshToken);
    return this.buildAuthResponse(refreshTokenPayload.userId);
  }

  async logout(payload: LogoutRequest) {
    await this.tokenProvider.revokeRefreshToken(payload.refreshToken);

    return ResponseApi.success({
      data: true,
    });
  }

  async me(userId: string) {
    return ResponseApi.success({
      data: await this.userService.getSessionUser(userId),
    });
  }

  private async buildAuthResponse(userId: string) {
    const sessionUser = await this.userService.getSessionUser(userId);
    if (!sessionUser) {
      throw new UnauthorizedException('Unable to build session user');
    }
    if (sessionUser.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('Your account is not active');
    }
    const accessToken = await this.tokenProvider.generateAccessToken({
      userId: sessionUser.id,
      roleId: sessionUser.role.id,
      roleName: sessionUser.role.name,
      roleCode: sessionUser.role.code,
    });
    const refreshToken = await this.tokenProvider.generateRefreshToken({
      userId: sessionUser.id,
    });

    return ResponseApi.success({
      data: {
        accessToken,
        refreshToken,
        user: sessionUser,
      },
    });
  }
}
