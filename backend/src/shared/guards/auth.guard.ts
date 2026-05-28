import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AUTH_KEY, AuthCondition, AuthName, TAuthCondition, TAuthName } from '../constants/auth.constant';
import { AccessTokenGuard } from './access-token.guard';
import { ApiKeyGuard } from './api-key.guard';

type AuthMeta = {
  authNames: TAuthName[];
  condition: TAuthCondition;
};

@Injectable()
export class AuthGuard implements CanActivate {
  private authMap: Record<TAuthName, CanActivate>;

  constructor(
    private readonly reflector: Reflector,
    private readonly accessTokenGuard: AccessTokenGuard,
    private readonly apiKeyGuard: ApiKeyGuard,
  ) {
    this.authMap = {
      [AuthName.Bearer]: accessTokenGuard,
      [AuthName.ApiKey]: apiKeyGuard,
      [AuthName.None]: { canActivate: () => true },
    };
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const { authNames, condition } = this.reflector.getAllAndOverride<AuthMeta>(AUTH_KEY, [
      context.getHandler(),
      context.getClass(),
    ]) ?? { authNames: [AuthName.Bearer], condition: AuthCondition.And };

    if (condition === AuthCondition.And) {
      let exception: UnauthorizedException | ForbiddenException | null = null;
      for (const name of authNames) {
        try {
          await this.authMap[name].canActivate(context);
        } catch (err: unknown) {
          exception = err as UnauthorizedException | ForbiddenException;
          break;
        }
      }
      if (exception) {
        throw exception;
      }
      return true;
    } else if (condition === AuthCondition.Or) {
      for (const name of authNames) {
        const canActivate = await this.authMap[name].canActivate(context);
        if (canActivate) {
          return true;
        }
      }
    }

    throw new UnauthorizedException('Unauthorized');
  }
}
