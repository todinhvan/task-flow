import { Module } from '@nestjs/common';
import { RealtimeModule } from '../realtime/realtime.module';
import { TaskController } from './controllers/task.controller';
import { TaskService } from './services/task.service';

@Module({
  imports: [RealtimeModule],
  controllers: [TaskController],
  providers: [TaskService],
})
export class TaskModule {}
