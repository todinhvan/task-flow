import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { TokenProvider } from '../providers/token.provider';
import { RequestWithMetadata } from '../types/request.type';

@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(private readonly tokenProvider: TokenProvider) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithMetadata>();
    const bearerToken = request.headers['authorization'];
    if (!bearerToken || bearerToken.split(' ')[0] !== 'Bearer' || bearerToken.split(' ')[1].trim().length === 0) {
      throw new UnauthorizedException('Invalid or missing access token');
    }

    const accessToken = bearerToken.split(' ')[1];
    try {
      request.currentUser = await this.tokenProvider.verifyAccessToken(accessToken);
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }
  }
}
