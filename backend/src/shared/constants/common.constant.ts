export const HttpMessage = {
  Ok: 'OK',
  Created: 'Created',
  Accepted: 'Accepted',
  NoContent: 'No Content',
  BadRequest: 'Bad Request',
  Unauthorized: 'Unauthorized',
  Forbidden: 'Forbidden',
  NotFound: 'Not Found',
  InternalServerError: 'Internal Server Error',
} as const;

export const MetadataKey = {
  RequestId: 'requestId',
  StartTime: 'startTime',
} as const;

export type TMetadataKey = (typeof MetadataKey)[keyof typeof MetadataKey];
