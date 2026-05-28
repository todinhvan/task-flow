import envConfig from '@/config';
import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  protected async shouldSkip(context: Parameters<ThrottlerGuard['shouldSkip']>[0]) {
    if (!envConfig.SecurityEnableRateLimit) {
      return true;
    }

    return super.shouldSkip(context);
  }
}
