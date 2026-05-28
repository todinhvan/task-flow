import { BadRequestException, HttpException, Logger } from '@nestjs/common';
import { HttpMessage } from '../constants/common.constant';
import { GlobalExceptionFilter } from './exception.filter';

describe('GlobalExceptionFilter', () => {
  const filter = new GlobalExceptionFilter();
  const loggerSpy = jest.spyOn(Logger, 'error').mockImplementation();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('formats HTTP exceptions on the happy path', () => {
    const json = jest.fn();
    const status = jest.fn(() => ({ json }));
    const host = {
      switchToHttp: () => ({
        getResponse: () => ({ status }),
        getRequest: () => ({
          method: 'POST',
          originalUrl: '/auth/login',
          requestId: 'req-1',
          startTime: Date.now() - 20,
        }),
      }),
    } as any;

    filter.catch(new BadRequestException('Invalid payload'), host);

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 400,
        requestId: 'req-1',
      }),
    );
    expect(loggerSpy).toHaveBeenCalled();
  });

  it('formats unknown exceptions as internal server errors', () => {
    const json = jest.fn();
    const status = jest.fn(() => ({ json }));
    const host = {
      switchToHttp: () => ({
        getResponse: () => ({ status }),
        getRequest: () => ({
          method: 'GET',
          originalUrl: '/tasks',
          requestId: 'req-2',
          startTime: Date.now() - 10,
        }),
      }),
    } as any;

    filter.catch(new Error('Boom'), host);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 500,
        message: HttpMessage.InternalServerError,
        error: HttpMessage.InternalServerError,
      }),
    );
  });

  it('does not write JSON when headers were already sent', () => {
    const end = jest.fn();
    const json = jest.fn();
    const status = jest.fn(() => ({ json }));
    const host = {
      switchToHttp: () => ({
        getResponse: () => ({
          headersSent: true,
          writableEnded: false,
          end,
          status,
        }),
        getRequest: () => ({
          method: 'GET',
          originalUrl: '/realtime/stream',
          requestId: 'req-sse',
          startTime: Date.now() - 5,
        }),
      }),
    } as any;

    filter.catch(new Error('Boom'), host);

    expect(status).not.toHaveBeenCalled();
    expect(json).not.toHaveBeenCalled();
    expect(end).toHaveBeenCalled();
  });
});
