import { UnauthorizedException } from '@nestjs/common';

jest.mock('uuid', () => ({
  v4: () => 'test-uuid',
}));

import { TokenProvider } from './token.provider';

describe('TokenProvider', () => {
  const jwtService = {
    signAsync: jest.fn(),
    verifyAsync: jest.fn(),
  };
  const prisma = {
    refreshToken: {
      create: jest.fn(),
      findUnique: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
  };
  const provider = new TokenProvider(jwtService as any, prisma as any);

  beforeEach(() => {
    jest.clearAllMocks();
    jwtService.signAsync.mockResolvedValue('signed-token');
    jwtService.verifyAsync.mockResolvedValue({ userId: 'user-1' });
    prisma.refreshToken.create.mockResolvedValue(undefined);
    prisma.refreshToken.delete.mockResolvedValue(undefined);
    prisma.refreshToken.deleteMany.mockResolvedValue(undefined);
  });

  it('generates and stores refresh tokens on the happy path', async () => {
    const result = await provider.generateRefreshToken({ userId: 'user-1' });

    expect(result).toBe('signed-token');
    expect(prisma.refreshToken.create).toHaveBeenCalled();
  });

  it('consumes valid refresh tokens on the happy path', async () => {
    prisma.refreshToken.findUnique.mockResolvedValue({
      token: 'refresh-token',
      expiresAt: new Date(Date.now() + 60_000),
    });

    const payload = await provider.consumeRefreshToken('refresh-token');

    expect(payload.userId).toBe('user-1');
    expect(prisma.refreshToken.delete).toHaveBeenCalledWith({
      where: { token: 'refresh-token' },
    });
  });

  it('rejects missing refresh token records', async () => {
    prisma.refreshToken.findUnique.mockResolvedValue(null);

    await expect(provider.consumeRefreshToken('refresh-token')).rejects.toThrow(UnauthorizedException);
  });

  it('skips revocation for blank refresh tokens', async () => {
    await provider.revokeRefreshToken('   ');

    expect(prisma.refreshToken.deleteMany).not.toHaveBeenCalled();
  });
});
