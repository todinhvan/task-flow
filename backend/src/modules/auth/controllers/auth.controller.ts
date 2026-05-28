import { CurrentUser } from '@/shared/decorators/current-user.decorator';
import { IsPublic } from '@/shared/decorators/auth.decorator';
import { LoginRequest, LogoutRequest, RefreshRequest, RegisterRequest } from '@/shared/interfaces/auth/auth-request.interface';
import envConfig from '@/config';
import { Body, Controller, Get, Ip, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from '../services/auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @IsPublic()
  @Post('register')
  @Throttle({
    default: {
      limit: envConfig.AuthRateLimitMax,
      ttl: envConfig.AuthRateLimitTtlSeconds * 1000,
    },
  })
  register(@Body() payload: RegisterRequest, @Ip() ipAddress: string) {
    return this.authService.register(payload, ipAddress);
  }

  @IsPublic()
  @Post('login')
  @Throttle({
    default: {
      limit: envConfig.AuthRateLimitMax,
      ttl: envConfig.AuthRateLimitTtlSeconds * 1000,
    },
  })
  login(@Body() payload: LoginRequest, @Ip() ipAddress: string) {
    return this.authService.login(payload, ipAddress);
  }

  @IsPublic()
  @Post('refresh')
  refresh(@Body() payload: RefreshRequest) {
    return this.authService.refresh(payload);
  }

  @IsPublic()
  @Post('logout')
  logout(@Body() payload: LogoutRequest) {
    return this.authService.logout(payload);
  }

  @Get('me')
  me(@CurrentUser('userId') userId: string) {
    return this.authService.me(userId);
  }
}
