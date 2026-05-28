import { ResponseApi } from '@/shared/interfaces/common/response.interface';
import { CloudinaryProvider } from '@/shared/providers/cloudinary.provider';
import { PrismaProvider } from '@/shared/providers/prisma.provider';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { UploadFolder } from '@/shared/constants/upload.constant';
import { UpdateProfileRequest } from '../dto/profile.dto';

@Injectable()
export class ProfileService {
  constructor(
    private readonly prisma: PrismaProvider,
    private readonly cloudinaryProvider: CloudinaryProvider,
  ) {}

  async getMyProfile(userId: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        deletedAt: null,
      },
      include: {
        role: true,
        profile: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return ResponseApi.success({
      data: {
        id: user.id,
        email: user.email,
        role: {
          id: user.role.id,
          code: user.role.code,
          name: user.role.name,
        },
        profile: user.profile,
      },
    });
  }

  async updateMyProfile(userId: string, payload: UpdateProfileRequest, avatar?: Express.Multer.File) {
    const profile = await this.prisma.userProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      throw new NotFoundException('Profile not found');
    }

    let uploadResult: any = null;
    if (avatar) {
      if (profile.avatarPublicId) {
        await this.cloudinaryProvider.destroy(profile.avatarPublicId, 'image');
      }

      uploadResult = await this.cloudinaryProvider.uploadBuffer({
        buffer: avatar.buffer,
        folder: UploadFolder.Avatar,
        fileName: avatar.originalname,
        mimeType: avatar.mimetype,
        resourceType: 'image',
      });
    }

    const updatedProfile = await this.prisma.userProfile.update({
      where: { userId },
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
        ...(uploadResult
          ? {
              avatarUrl: uploadResult.secure_url,
              avatarPublicId: uploadResult.public_id,
              avatarMimeType: avatar?.mimetype,
              avatarSize: avatar?.size,
            }
          : {}),
      },
    });

    return ResponseApi.success({
      data: updatedProfile,
    });
  }
}
