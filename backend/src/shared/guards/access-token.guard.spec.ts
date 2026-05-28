import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AccessTokenGuard } from './access-token.guard';

describe('AccessTokenGuard', () => {
  const tokenProvider = {
    verifyAccessToken: jest.fn(),
  };
  const guard = new AccessTokenGuard(tokenProvider as any);

  function createContext(headers: Record<string, string>) {
    const request: any = { headers };
    const context = {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as ExecutionContext;

    return { request, context };
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('accepts valid bearer tokens on the happy path', async () => {
    tokenProvider.verifyAccessToken.mockResolvedValue({ userId: 'user-1' });
    const { request, context } = createContext({
      authorization: 'Bearer access-token',
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.currentUser.userId).toBe('user-1');
  });

  it('rejects missing bearer tokens', async () => {
    const { context } = createContext({});

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });
});
