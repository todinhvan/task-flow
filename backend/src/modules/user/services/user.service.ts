import { RoleCode } from '@/generated/prisma/enums';
import { PrismaProvider } from '@/shared/providers/prisma.provider';
import { ResponseApi } from '@/shared/interfaces/common/response.interface';
import { CloudinaryProvider } from '@/shared/providers/cloudinary.provider';
import { HashingProvider } from '@/shared/providers/hashing.provider';
import { WorkspaceProvisionProvider } from '@/shared/providers/workspace-provision.provider';
import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { UploadFolder } from '@/shared/constants/upload.constant';
import { CreateUserRequest, ListUsersQuery, UpdateUserRequest } from '../dto/user.dto';
import { UserRepository } from '../repositories/user.repository';

const ADMIN_ONLY_MESSAGE = 'Only administrators can perform this action';

@Injectable()
export class UserService {
  constructor(
    private readonly prisma: PrismaProvider,
    private readonly userRepository: UserRepository,
    private readonly hashingProvider: HashingProvider,
    private readonly workspaceProvisionProvider: WorkspaceProvisionProvider,
    private readonly cloudinaryProvider: CloudinaryProvider,
  ) {}

  async listUsers(query: ListUsersQuery, currentRoleCode: string) {
    this.ensureAdmin(currentRoleCode);

    const users = await this.userRepository.findMany(query);
    return ResponseApi.success({
      data: users.map((user) => this.mapUser(user)),
    });
  }

  async getUserById(id: string, currentRoleCode: string) {
    this.ensureAdmin(currentRoleCode);

    const user = await this.userRepository.findActiveById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return ResponseApi.success({
      data: this.mapUser(user),
    });
  }

  async getEmployees(currentRoleCode: string) {
    if (currentRoleCode !== RoleCode.ADMIN && currentRoleCode !== RoleCode.MANAGER) {
      throw new ForbiddenException('You do not have permission to view employees');
    }

    const employees = await this.prisma.user.findMany({
      where: {
        deletedAt: null,
        role: {
          code: RoleCode.EMPLOYEE,
        },
      },
      include: {
        profile: true,
      },
      orderBy: {
        profile: {
          fullName: 'asc',
        },
      },
    });

    return ResponseApi.success({
      data: employees.map((employee) => ({
        id: employee.id,
        email: employee.email,
        fullName: employee.profile?.fullName ?? employee.email,
        avatarUrl: employee.profile?.avatarUrl ?? null,
        jobTitle: employee.profile?.jobTitle ?? null,
      })),
    });
  }

  async createUser(payload: CreateUserRequest, avatar: Express.Multer.File | undefined, currentRoleCode: string) {
    this.ensureAdmin(currentRoleCode);

    const role = await this.prisma.role.findUnique({
      where: { code: payload.roleCode },
    });
    if (!role) {
      throw new BadRequestException('Role does not exist');
    }

    const existing = await this.userRepository.findActiveByEmail(payload.email);
    if (existing) {
      throw new BadRequestException('Email is already in use');
    }

    const hashedPassword = await this.hashingProvider.hash(payload.password);
    const user = await this.prisma.user.create({
      data: {
        email: payload.email,
        password: hashedPassword,
        roleId: role.id,
      },
      include: {
        role: true,
        profile: true,
      },
    });

    await this.workspaceProvisionProvider.provisionForUser({
      userId: user.id,
      fullName: payload.fullName,
      jobTitle: payload.jobTitle,
    });

    const avatarUpload = avatar
      ? await this.cloudinaryProvider.uploadBuffer({
          buffer: avatar.buffer,
          folder: UploadFolder.Avatar,
          fileName: avatar.originalname,
          mimeType: avatar.mimetype,
          resourceType: 'image',
        })
      : null;

    await this.prisma.userProfile.update({
      where: { userId: user.id },
      data: {
        fullName: payload.fullName,
        phoneNumber: payload.phoneNumber,
        jobTitle: payload.jobTitle,
        department: payload.department,
        bio: payload.bio,
        location: payload.location,
        dateOfBirth: payload.dateOfBirth ? new Date(payload.dateOfBirth) : null,
        ...(avatarUpload
          ? {
              avatarUrl: avatarUpload.secure_url,
              avatarPublicId: avatarUpload.public_id,
              avatarMimeType: avatar?.mimetype,
              avatarSize: avatar?.size,
            }
          : {}),
      },
    });

    const createdUser = await this.userRepository.findActiveById(user.id);
    return ResponseApi.success({
      message: 'Created',
      status: 201,
      data: this.mapUser(createdUser),
    });
  }

  async updateUser(
    id: string,
    payload: UpdateUserRequest,
    avatar: Express.Multer.File | undefined,
    currentRoleCode: string,
    currentUserId: string,
  ) {
    this.ensureAdmin(currentRoleCode);

    const existing = await this.userRepository.findActiveById(id);
    if (!existing) {
      throw new NotFoundException('User not found');
    }

    if (currentUserId === id && payload.status === 'BLOCKED') {
      throw new BadRequestException('You cannot block the current account during this request');
    }

    if (payload.email && payload.email !== existing.email) {
      const emailOwner = await this.userRepository.findActiveByEmail(payload.email);
      if (emailOwner && emailOwner.id !== id) {
        throw new BadRequestException('Email is already in use');
      }
    }

    if (payload.roleCode) {
      const role = await this.prisma.role.findUnique({
        where: { code: payload.roleCode },
      });
      if (!role) {
        throw new BadRequestException('Role does not exist');
      }
      existing.role = role as typeof existing.role;
    }

    let avatarUpload: any = null;
    if (avatar) {
      if (existing.profile?.avatarPublicId) {
        await this.cloudinaryProvider.destroy(existing.profile.avatarPublicId, 'image');
      }
      avatarUpload = await this.cloudinaryProvider.uploadBuffer({
        buffer: avatar.buffer,
        folder: UploadFolder.Avatar,
        fileName: avatar.originalname,
        mimeType: avatar.mimetype,
        resourceType: 'image',
      });
    }

    const role = payload.roleCode
      ? await this.prisma.role.findUnique({
          where: { code: payload.roleCode },
        })
      : null;

    await this.prisma.user.update({
      where: { id },
      data: {
        email: payload.email,
        status: payload.status,
        ...(payload.password ? { password: await this.hashingProvider.hash(payload.password) } : {}),
        ...(role ? { roleId: role.id } : {}),
      },
    });

    await this.workspaceProvisionProvider.provisionForUser({
      userId: id,
      fullName: payload.fullName ?? existing.profile?.fullName ?? existing.email,
      jobTitle: payload.jobTitle ?? existing.profile?.jobTitle,
    });

    await this.prisma.userProfile.update({
      where: { userId: id },
      data: {
        ...(payload.fullName !== undefined ? { fullName: payload.fullName } : {}),
        ...(payload.phoneNumber !== undefined ? { phoneNumber: payload.phoneNumber } : {}),
        ...(payload.jobTitle !== undefined ? { jobTitle: payload.jobTitle } : {}),
        ...(payload.department !== undefined ? { department: payload.department } : {}),
        ...(payload.bio !== undefined ? { bio: payload.bio } : {}),
        ...(payload.location !== undefined ? { location: payload.location } : {}),
        ...(payload.dateOfBirth !== undefined
          ? { dateOfBirth: payload.dateOfBirth ? new Date(payload.dateOfBirth) : null }
          : {}),
        ...(avatarUpload
          ? {
              avatarUrl: avatarUpload.secure_url,
              avatarPublicId: avatarUpload.public_id,
              avatarMimeType: avatar?.mimetype,
              avatarSize: avatar?.size,
            }
          : {}),
      },
    });
    const updatedUser = await this.userRepository.findActiveById(id);
    return ResponseApi.success({
      data: this.mapUser(updatedUser),
    });
  }

  async deleteUser(id: string, currentRoleCode: string, currentUserId: string) {
    this.ensureAdmin(currentRoleCode);

    if (id === currentUserId) {
      throw new BadRequestException('You cannot delete your own account');
    }

    const existing = await this.userRepository.findActiveById(id);
    if (!existing) {
      throw new NotFoundException('User not found');
    }

    await this.prisma.$transaction([
      this.prisma.refreshToken.deleteMany({
        where: { userId: id },
      }),
      this.prisma.user.update({
        where: { id },
        data: {
          deletedAt: new Date(),
          status: 'INACTIVE',
        },
      }),
    ]);

    return ResponseApi.success({
      data: true,
    });
  }

  async getSessionUser(userId: string) {
    const user = await this.userRepository.findActiveById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.mapUser(user)!;
  }

  private ensureAdmin(roleCode: string) {
    if (roleCode !== RoleCode.ADMIN) {
      throw new ForbiddenException(ADMIN_ONLY_MESSAGE);
    }
  }

  private mapUser(user: Awaited<ReturnType<UserRepository['findActiveById']>>) {
    if (!user) {
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      status: user.status,
      role: {
        id: user.role.id,
        code: user.role.code,
        name: user.role.name,
        permissions: user.role.permissions.map((permission) => ({
          id: permission.id,
          code: permission.code,
          name: permission.name,
          module: permission.module,
          method: permission.method,
          path: permission.path,
        })),
      },
      profile: {
        id: user.profile?.id ?? null,
        fullName: user.profile?.fullName ?? user.email,
        phoneNumber: user.profile?.phoneNumber ?? null,
        jobTitle: user.profile?.jobTitle ?? null,
        department: user.profile?.department ?? null,
        bio: user.profile?.bio ?? null,
        location: user.profile?.location ?? null,
        dateOfBirth: user.profile?.dateOfBirth ?? null,
        avatarUrl: user.profile?.avatarUrl ?? null,
      },
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
