import { CurrentUser } from '@/shared/decorators/current-user.decorator';
import { validateAvatarFile } from '@/shared/utils/file.util';
import envConfig from '@/config';
import { UploadLimit } from '@/shared/constants/upload.constant';
import { Body, Controller, Get, Patch, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { memoryStorage } from 'multer';
import { UpdateProfileRequest } from '../dto/profile.dto';
import { ProfileService } from '../services/profile.service';

@Controller('profiles')
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get('me')
  getMyProfile(@CurrentUser('userId') userId: string) {
    return this.profileService.getMyProfile(userId);
  }

  @Patch('me')
  @Throttle({
    default: {
      limit: envConfig.UploadRateLimitMax,
      ttl: envConfig.UploadRateLimitTtlSeconds * 1000,
    },
  })
  @UseInterceptors(
    FileInterceptor('avatar', {
      storage: memoryStorage(),
      limits: {
        fileSize: UploadLimit.AvatarMb * 1024 * 1024,
        files: 1,
      },
    }),
  )
  updateMyProfile(
    @CurrentUser('userId') userId: string,
    @Body() payload: UpdateProfileRequest,
    @UploadedFile() avatar: Express.Multer.File | undefined,
  ) {
    validateAvatarFile(avatar);
    return this.profileService.updateMyProfile(userId, payload, avatar);
  }
}
