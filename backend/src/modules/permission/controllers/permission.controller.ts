import { CurrentUser } from '@/shared/decorators/current-user.decorator';
import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import {
  CreatePermissionRequest,
  ListPermissionsQuery,
  UpdatePermissionRequest,
} from '../dto/permission.dto';
import { PermissionService } from '../services/permission.service';

@Controller('permissions')
export class PermissionController {
  constructor(private readonly permissionService: PermissionService) {}

  @Get()
  listPermissions(@Query() query: ListPermissionsQuery, @CurrentUser('roleCode') roleCode: string) {
    return this.permissionService.listPermissions(query, roleCode);
  }

  @Get(':id')
  getPermission(@Param('id') id: string, @CurrentUser('roleCode') roleCode: string) {
    return this.permissionService.getPermissionById(id, roleCode);
  }

  @Post()
  createPermission(@Body() payload: CreatePermissionRequest, @CurrentUser('roleCode') roleCode: string) {
    return this.permissionService.createPermission(payload, roleCode);
  }

  @Patch(':id')
  updatePermission(
    @Param('id') id: string,
    @Body() payload: UpdatePermissionRequest,
    @CurrentUser('roleCode') roleCode: string,
  ) {
    return this.permissionService.updatePermission(id, payload, roleCode);
  }

  @Delete(':id')
  deletePermission(@Param('id') id: string, @CurrentUser('roleCode') roleCode: string) {
    return this.permissionService.deletePermission(id, roleCode);
  }
}
