import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { TMetadataKey } from '../constants/common.constant';
import { RequestWithMetadata } from '../types/request.type';

export const RequestParam = createParamDecorator((field: TMetadataKey, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest<RequestWithMetadata>();
  return field ? request[field] : request;
});
