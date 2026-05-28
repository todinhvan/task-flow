import { Request } from 'express';
import { MetadataKey } from '../constants/common.constant';
import { AccessTokenPayloadType } from './token.type';

export type RequestWithMetadata = Request & {
  [MetadataKey.RequestId]: string;
  [MetadataKey.StartTime]: number;
  currentUser?: AccessTokenPayloadType;
};
