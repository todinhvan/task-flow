import { CurrentUser } from '@/shared/decorators/current-user.decorator';
import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CreateRoleRequest, ListRolesQuery, UpdateRoleRequest } from '../dto/role.dto';
import { RoleService } from '../services/role.service';

@Controller('roles')
export class RoleController {
  constructor(private readonly roleService: RoleService) {}

  @Get()
  listRoles(@Query() query: ListRolesQuery, @CurrentUser('roleCode') roleCode: string) {
    return this.roleService.listRoles(query, roleCode);
  }

  @Get(':id')
  getRole(@Param('id') id: string, @CurrentUser('roleCode') roleCode: string) {
    return this.roleService.getRoleById(id, roleCode);
  }

  @Post()
  createRole(@Body() payload: CreateRoleRequest, @CurrentUser('roleCode') roleCode: string) {
    return this.roleService.createRole(payload, roleCode);
  }

  @Patch(':id')
  updateRole(
    @Param('id') id: string,
    @Body() payload: UpdateRoleRequest,
    @CurrentUser('roleCode') roleCode: string,
  ) {
    return this.roleService.updateRole(id, payload, roleCode);
  }

  @Delete(':id')
  deleteRole(@Param('id') id: string, @CurrentUser('roleCode') roleCode: string) {
    return this.roleService.deleteRole(id, roleCode);
  }
}
