import envConfig from '@/config';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import ms, { StringValue } from 'ms';
import { v4 } from 'uuid';
import { AccessTokenPayloadType, RefreshTokenPayloadType } from '../types/token.type';
import { PrismaProvider } from './prisma.provider';

@Injectable()
export class TokenProvider {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaProvider,
  ) {}

  generateAccessToken(payload: Omit<AccessTokenPayloadType, 'iat' | 'exp'>) {
    return this.jwtService.signAsync(
      { uuid: v4(), ...payload },
      {
        algorithm: 'HS256',
        secret: envConfig.JwtATSecret,
        expiresIn: envConfig.JwtATExpiration as StringValue,
      },
    );
  }

  async generateRefreshToken(payload: Omit<RefreshTokenPayloadType, 'iat' | 'exp'>) {
    const refreshToken = await this.jwtService.signAsync(
      { uuid: v4(), ...payload },
      {
        algorithm: 'HS256',
        secret: envConfig.JwtRTSecret,
        expiresIn: envConfig.JwtRTExpiration as StringValue,
      },
    );

    const expiresAt = new Date(Date.now() + ms(envConfig.JwtRTExpiration as StringValue));
    await this.prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: payload.userId,
        expiresAt,
      },
    });

    return refreshToken;
  }

  verifyAccessToken(token: string) {
    return this.jwtService.verifyAsync<AccessTokenPayloadType>(token, {
      secret: envConfig.JwtATSecret,
      algorithms: ['HS256'],
    });
  }

  verifyRefreshToken(token: string) {
    return this.jwtService.verifyAsync<RefreshTokenPayloadType>(token, {
      secret: envConfig.JwtRTSecret,
      algorithms: ['HS256'],
    });
  }

  async consumeRefreshToken(token: string) {
    const refreshToken = token.trim();
    const payload = await this.verifyRefreshToken(refreshToken).catch(() => {
      throw new UnauthorizedException('Invalid or expired refresh token');
    });

    const storedToken = await this.prisma.refreshToken.findUnique({
      where: {
        token: refreshToken,
      },
    });

    if (!storedToken || storedToken.expiresAt.getTime() <= Date.now()) {
      if (storedToken) {
        await this.prisma.refreshToken.delete({
          where: {
            token: refreshToken,
          },
        });
      }

      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    await this.prisma.refreshToken.delete({
      where: {
        token: refreshToken,
      },
    });

    return payload;
  }

  async revokeRefreshToken(token: string) {
    const refreshToken = token.trim();
    if (refreshToken.length === 0) {
      return;
    }

    await this.prisma.refreshToken.deleteMany({
      where: {
        token: refreshToken,
      },
    });
  }
}
