import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthCondition, AuthName } from '../constants/auth.constant';
import { AuthGuard } from './auth.guard';

describe('AuthGuard', () => {
  const reflector = {
    getAllAndOverride: jest.fn(),
  };
  const accessTokenGuard = { canActivate: jest.fn() };
  const apiKeyGuard = { canActivate: jest.fn() };
  const guard = new AuthGuard(reflector as unknown as Reflector, accessTokenGuard as any, apiKeyGuard as any);
  const context = {
    getHandler: jest.fn(() => function handler() {}),
    getClass: jest.fn(() => class TestController {}),
  } as unknown as ExecutionContext;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uses bearer auth by default on the happy path', async () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    accessTokenGuard.canActivate.mockResolvedValue(true);

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('supports OR authentication flows', async () => {
    reflector.getAllAndOverride.mockReturnValue({
      authNames: [AuthName.ApiKey, AuthName.Bearer],
      condition: AuthCondition.Or,
    });
    apiKeyGuard.canActivate.mockResolvedValue(false);
    accessTokenGuard.canActivate.mockResolvedValue(true);

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('throws unauthorized when every auth strategy fails', async () => {
    reflector.getAllAndOverride.mockReturnValue({
      authNames: [AuthName.ApiKey],
      condition: AuthCondition.Or,
    });
    apiKeyGuard.canActivate.mockResolvedValue(false);

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });
});
