import envConfig from '@/config';
import { ThrottlerGuard } from '@nestjs/throttler';
import { AppThrottlerGuard } from './app-throttler.guard';

describe('AppThrottlerGuard', () => {
  const originalSetting = envConfig.SecurityEnableRateLimit;

  afterAll(() => {
    envConfig.SecurityEnableRateLimit = originalSetting;
  });

  it('skips throttling when rate limiting is disabled', async () => {
    envConfig.SecurityEnableRateLimit = false;
    const guard = Object.create(AppThrottlerGuard.prototype) as AppThrottlerGuard;

    await expect((guard as any).shouldSkip({})).resolves.toBe(true);
  });

  it('delegates to the base guard when rate limiting is enabled', async () => {
    envConfig.SecurityEnableRateLimit = true;
    const baseSpy = jest.spyOn(ThrottlerGuard.prototype as any, 'shouldSkip').mockResolvedValue(false);
    const guard = Object.create(AppThrottlerGuard.prototype) as AppThrottlerGuard;

    await expect((guard as any).shouldSkip({ route: '/auth/login' })).resolves.toBe(false);
    expect(baseSpy).toHaveBeenCalled();
  });
});
