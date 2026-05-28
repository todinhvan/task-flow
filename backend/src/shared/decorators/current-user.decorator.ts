import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { RequestWithMetadata } from '../types/request.type';

export const CurrentUser = createParamDecorator((field: string | undefined, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest<RequestWithMetadata>();
  const user = request.currentUser;

  if (!field) {
    return user;
  }

  return user?.[field];
});
