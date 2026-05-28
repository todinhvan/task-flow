import { CurrentUser } from '@/shared/decorators/current-user.decorator';
import { UploadLimit } from '@/shared/constants/upload.constant';
import { ResponseApi } from '@/shared/interfaces/common/response.interface';
import { validateAvatarFile } from '@/shared/utils/file.util';
import envConfig from '@/config';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { memoryStorage } from 'multer';
import { CreateUserRequest, ListUsersQuery, UpdateUserRequest } from '../dto/user.dto';
import { UserService } from '../services/user.service';

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  listUsers(@Query() query: ListUsersQuery, @CurrentUser('roleCode') roleCode: string) {
    return this.userService.listUsers(query, roleCode);
  }

  @Get('options/employees')
  getEmployees(@CurrentUser('roleCode') roleCode: string) {
    return this.userService.getEmployees(roleCode);
  }

  @Get(':id')
  getUser(@Param('id') id: string, @CurrentUser('roleCode') roleCode: string) {
    return this.userService.getUserById(id, roleCode);
  }

  @Post()
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
  createUser(
    @Body() payload: CreateUserRequest,
    @UploadedFile() avatar: Express.Multer.File | undefined,
    @CurrentUser('roleCode') roleCode: string,
  ) {
    validateAvatarFile(avatar);
    return this.userService.createUser(payload, avatar, roleCode);
  }

  @Patch(':id')
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
  updateUser(
    @Param('id') id: string,
    @Body() payload: UpdateUserRequest,
    @UploadedFile() avatar: Express.Multer.File | undefined,
    @CurrentUser('roleCode') roleCode: string,
    @CurrentUser('userId') currentUserId: string,
  ) {
    validateAvatarFile(avatar);
    return this.userService.updateUser(id, payload, avatar, roleCode, currentUserId);
  }

  @Delete(':id')
  deleteUser(
    @Param('id') id: string,
    @CurrentUser('roleCode') roleCode: string,
    @CurrentUser('userId') currentUserId: string,
  ) {
    return this.userService.deleteUser(id, roleCode, currentUserId);
  }
}
