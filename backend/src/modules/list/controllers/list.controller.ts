import { CurrentUser } from '@/shared/decorators/current-user.decorator';
import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { CreateListRequest, ReorderListsRequest, UpdateListRequest } from '../dto/list.dto';
import { ListService } from '../services/list.service';

@Controller('lists')
export class ListController {
  constructor(private readonly listService: ListService) {}

  @Get()
  getMyLists(@CurrentUser('userId') userId: string) {
    return this.listService.getMyLists(userId);
  }

  @Post()
  createList(@CurrentUser('userId') userId: string, @Body() payload: CreateListRequest) {
    return this.listService.createList(userId, payload);
  }

  @Patch('reorder')
  reorderLists(@CurrentUser('userId') userId: string, @Body() payload: ReorderListsRequest) {
    return this.listService.reorderLists(userId, payload);
  }

  @Patch(':id')
  updateList(
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
    @Body() payload: UpdateListRequest,
  ) {
    return this.listService.updateList(userId, id, payload);
  }

  @Delete(':id')
  deleteList(@CurrentUser('userId') userId: string, @Param('id') id: string) {
    return this.listService.deleteList(userId, id);
  }
}
