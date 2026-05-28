import { Module } from '@nestjs/common';
import { ListController } from './controllers/list.controller';
import { ListService } from './services/list.service';

@Module({
  controllers: [ListController],
  providers: [ListService],
  exports: [ListService],
})
export class ListModule {}
