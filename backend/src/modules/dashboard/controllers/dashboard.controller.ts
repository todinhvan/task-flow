import { CurrentUser } from '@/shared/decorators/current-user.decorator';
import { Controller, Get } from '@nestjs/common';
import { DashboardService } from '../services/dashboard.service';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('admin')
  getAdminDashboard(@CurrentUser('roleCode') roleCode: string) {
    return this.dashboardService.getAdminDashboard(roleCode);
  }
}
