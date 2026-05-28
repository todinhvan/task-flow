import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import envConfig from '@/config';
import { ApiKeyGuard } from './api-key.guard';

describe('ApiKeyGuard', () => {
  const guard = new ApiKeyGuard();
  const originalApiKeySecret = envConfig.ApiKeySecret;

  function createContext(value?: string) {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          headers: value ? { 'x-api-key': value } : {},
        }),
      }),
    } as ExecutionContext;
  }

  beforeEach(() => {
    envConfig.ApiKeySecret = 'expected-key';
  });

  afterAll(() => {
    envConfig.ApiKeySecret = originalApiKeySecret;
  });

  it('accepts the configured api key on the happy path', () => {
    expect(guard.canActivate(createContext('expected-key'))).toBe(true);
  });

  it('rejects invalid api keys', () => {
    expect(() => guard.canActivate(createContext('invalid'))).toThrow(UnauthorizedException);
  });
});
