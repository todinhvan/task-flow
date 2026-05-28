import { CurrentUser } from '@/shared/decorators/current-user.decorator';
import { UploadLimit } from '@/shared/constants/upload.constant';
import { validateAttachments } from '@/shared/utils/file.util';
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
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { memoryStorage } from 'multer';
import {
  CreateTaskRequest,
  ListTasksQuery,
  MoveTaskRequest,
  UpdateTaskRequest,
  UpdateTaskStatusRequest,
} from '../dto/task.dto';
import { TaskService } from '../services/task.service';

@Controller('tasks')
export class TaskController {
  constructor(private readonly taskService: TaskService) {}

  @Get()
  listTasks(
    @Query() query: ListTasksQuery,
    @CurrentUser('userId') userId: string,
    @CurrentUser('roleCode') roleCode: string,
  ) {
    return this.taskService.listTasks(query, { userId, roleCode });
  }

  @Get(':id')
  getTask(
    @Param('id') id: string,
    @CurrentUser('userId') userId: string,
    @CurrentUser('roleCode') roleCode: string,
  ) {
    return this.taskService.getTaskById(id, { userId, roleCode });
  }

  @Post()
  @Throttle({
    default: {
      limit: envConfig.UploadRateLimitMax,
      ttl: envConfig.UploadRateLimitTtlSeconds * 1000,
    },
  })
  @UseInterceptors(
    FilesInterceptor('attachments', 5, {
      storage: memoryStorage(),
      limits: {
        fileSize: UploadLimit.AttachmentMb * 1024 * 1024,
        files: UploadLimit.MaxAttachmentCount,
      },
    }),
  )
  createTask(
    @Body() payload: CreateTaskRequest,
    @UploadedFiles() attachments: Express.Multer.File[],
    @CurrentUser('userId') userId: string,
    @CurrentUser('roleCode') roleCode: string,
  ) {
    validateAttachments(attachments ?? []);
    return this.taskService.createTask(payload, attachments ?? [], { userId, roleCode });
  }

  @Patch(':id')
  updateTask(
    @Param('id') id: string,
    @Body() payload: UpdateTaskRequest,
    @CurrentUser('userId') userId: string,
    @CurrentUser('roleCode') roleCode: string,
  ) {
    return this.taskService.updateTask(id, payload, { userId, roleCode });
  }

  @Patch(':id/status')
  updateTaskStatus(
    @Param('id') id: string,
    @Body() payload: UpdateTaskStatusRequest,
    @CurrentUser('userId') userId: string,
    @CurrentUser('roleCode') roleCode: string,
  ) {
    return this.taskService.updateTaskStatus(id, payload, { userId, roleCode });
  }

  @Patch(':id/dismiss')
  dismissAssignedTask(
    @Param('id') id: string,
    @CurrentUser('userId') userId: string,
    @CurrentUser('roleCode') roleCode: string,
  ) {
    return this.taskService.dismissAssignedTask(id, { userId, roleCode });
  }

  @Patch(':id/move')
  moveTask(
    @Param('id') id: string,
    @Body() payload: MoveTaskRequest,
    @CurrentUser('userId') userId: string,
    @CurrentUser('roleCode') roleCode: string,
  ) {
    return this.taskService.moveTask(id, payload, { userId, roleCode });
  }

  @Post(':id/attachments')
  @Throttle({
    default: {
      limit: envConfig.UploadRateLimitMax,
      ttl: envConfig.UploadRateLimitTtlSeconds * 1000,
    },
  })
  @UseInterceptors(
    FilesInterceptor('attachments', 5, {
      storage: memoryStorage(),
      limits: {
        fileSize: UploadLimit.AttachmentMb * 1024 * 1024,
        files: UploadLimit.MaxAttachmentCount,
      },
    }),
  )
  addAttachments(
    @Param('id') id: string,
    @UploadedFiles() attachments: Express.Multer.File[],
    @CurrentUser('userId') userId: string,
    @CurrentUser('roleCode') roleCode: string,
  ) {
    validateAttachments(attachments ?? []);
    return this.taskService.addAttachments(id, attachments ?? [], { userId, roleCode });
  }

  @Delete(':taskId/attachments/:attachmentId')
  deleteAttachment(
    @Param('taskId') taskId: string,
    @Param('attachmentId') attachmentId: string,
    @CurrentUser('userId') userId: string,
    @CurrentUser('roleCode') roleCode: string,
  ) {
    return this.taskService.deleteAttachment(taskId, attachmentId, { userId, roleCode });
  }

  @Delete(':id')
  deleteTask(
    @Param('id') id: string,
    @CurrentUser('userId') userId: string,
    @CurrentUser('roleCode') roleCode: string,
  ) {
    return this.taskService.deleteTask(id, { userId, roleCode });
  }
}
