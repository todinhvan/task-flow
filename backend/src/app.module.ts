import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './modules/auth/auth.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { ListModule } from './modules/list/list.module';
import { PermissionModule } from './modules/permission/permission.module';
import { ProfileModule } from './modules/profile/profile.module';
import { RealtimeModule } from './modules/realtime/realtime.module';
import { RoleModule } from './modules/role/role.module';
import { TaskModule } from './modules/task/task.module';
import { UserModule } from './modules/user/user.module';
import { GlobalExceptionFilter } from './shared/filters/exception.filter';
import { AccessTokenGuard } from './shared/guards/access-token.guard';
import { AppThrottlerGuard } from './shared/guards/app-throttler.guard';
import { ApiKeyGuard } from './shared/guards/api-key.guard';
import { AuthGuard } from './shared/guards/auth.guard';
import { ResponseInterceptor } from './shared/interceptors/response.interceptor';
import { ReRequestMiddleware } from './shared/middlewares/re-request.middleware';
import { SharedModule } from './shared/shared.module';
import envConfig from './config';

const modules = [
  AuthModule,
  UserModule,
  ProfileModule,
  ListModule,
  TaskModule,
  RoleModule,
  PermissionModule,
  DashboardModule,
  RealtimeModule,
];

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: envConfig.GlobalRateLimitTtlSeconds * 1000,
        limit: envConfig.GlobalRateLimitMax,
      },
    ]),
    ...modules,
    SharedModule,
  ],
  providers: [
    AccessTokenGuard,
    ApiKeyGuard,
    AppThrottlerGuard,
    {
      provide: APP_INTERCEPTOR,
      useClass: ResponseInterceptor,
    },
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: AppThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(ReRequestMiddleware).forRoutes('*path');
  }
}
