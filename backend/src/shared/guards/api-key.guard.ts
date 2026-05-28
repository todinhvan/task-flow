import envConfig from '@/config';
import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { timingSafeEqual } from 'crypto';
import { RequestWithMetadata } from '../types/request.type';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithMetadata>();
    const apiKey = request.headers['x-api-key'];
    const providedKey = Array.isArray(apiKey) ? apiKey[0] : apiKey;
    if (!providedKey || !envConfig.ApiKeySecret) {
      throw new UnauthorizedException('Invalid or missing API key');
    }

    const expectedBuffer = Buffer.from(envConfig.ApiKeySecret);
    const providedBuffer = Buffer.from(providedKey);
    if (expectedBuffer.length !== providedBuffer.length || !timingSafeEqual(expectedBuffer, providedBuffer)) {
      throw new UnauthorizedException('Invalid or missing API key');
    }

    return true;
  }
}
