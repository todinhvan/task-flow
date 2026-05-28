jest.mock('../utils/string.util', () => ({
  generateRequestId: () => 'req-test-id',
}));

import { Logger } from '@nestjs/common';
import { MetadataKey } from '../constants/common.constant';
import { ReRequestMiddleware } from './re-request.middleware';

describe('ReRequestMiddleware', () => {
  const middleware = new ReRequestMiddleware();
  const loggerSpy = jest.spyOn(Logger, 'log').mockImplementation();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('attaches request metadata on the happy path', () => {
    const next = jest.fn();
    const req = {
      method: 'GET',
      originalUrl: '/health',
    } as any;

    middleware.use(req, {} as any, next);

    expect(req[MetadataKey.RequestId]).toBe('req-test-id');
    expect(typeof req[MetadataKey.StartTime]).toBe('number');
    expect(loggerSpy).toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });
});
