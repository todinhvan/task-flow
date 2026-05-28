import { Injectable, Logger, OnModuleInit } from '@nestjs/common';

@Injectable()
export class BootstrapProvider implements OnModuleInit {
  onModuleInit() {
    Logger.log('Runtime bootstrap data is disabled. Use Prisma migrations for seed data.');
  }
}
