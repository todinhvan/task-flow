import { Logger } from '@nestjs/common';
import { of, firstValueFrom } from 'rxjs';
import { ResponseApi } from '../interfaces/common/response.interface';
import { ResponseInterceptor } from './response.interceptor';

describe('ResponseInterceptor', () => {
  const interceptor = new ResponseInterceptor();
  const loggerSpy = jest.spyOn(Logger, 'log').mockImplementation();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('enriches successful responses with request metadata', async () => {
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          method: 'GET',
          originalUrl: '/tasks',
          requestId: 'req-1',
          startTime: Date.now() - 10,
        }),
      }),
    } as any;

    const next = {
      handle: () =>
        of(
          ResponseApi.success({
            data: true,
          }),
        ),
    };

    const result = await firstValueFrom(interceptor.intercept(context, next));

    expect(result.requestId).toBe('req-1');
    expect(result.duration).toMatch(/ms$/);
    expect(loggerSpy).toHaveBeenCalled();
  });

  it('passes through manual stream responses without mutation', async () => {
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          method: 'GET',
          originalUrl: '/realtime/stream',
          requestId: 'req-sse',
          startTime: Date.now() - 5,
        }),
      }),
    } as any;

    const next = {
      handle: () => of(undefined),
    };

    const result = await firstValueFrom(interceptor.intercept(context, next));

    expect(result).toBeUndefined();
    expect(loggerSpy).toHaveBeenCalled();
  });
});
