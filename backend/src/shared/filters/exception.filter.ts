import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Response } from 'express';
import { HttpMessage } from '../constants/common.constant';
import { ErrorResponse } from '../interfaces/common/response.interface';
import { RequestWithMetadata } from '../types/request.type';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const { method, originalUrl, requestId, startTime } = ctx.getRequest<RequestWithMetadata>();
    const duration = Date.now() - startTime;

    const errorResponse = new ErrorResponse();
    errorResponse.requestId = requestId;
    errorResponse.duration = `${duration}ms`;
    errorResponse.status = HttpStatus.INTERNAL_SERVER_ERROR;
    errorResponse.message = HttpMessage.InternalServerError;

    if (exception instanceof HttpException) {
      Logger.error(exception.message, exception.stack);
      errorResponse.status = exception.getStatus();
      const responsePayload = exception.getResponse();
      if (typeof responsePayload === 'string') {
        errorResponse.message = responsePayload;
        errorResponse.error = responsePayload;
      } else {
        const payload = responsePayload as Record<string, unknown>;
        errorResponse.message = (payload.error as string) || exception.message;
        errorResponse.error = payload.message || exception.message;
      }
    } else {
      Logger.error(exception);
      errorResponse.error = HttpMessage.InternalServerError;
    }

    Logger.error(`HTTP(Error) >> [${method} ${originalUrl}] >> '${requestId}'. Duration: ${duration}ms.`);
    if (response.headersSent) {
      if (!response.writableEnded) {
        response.end();
      }
      return;
    }

    response.status(errorResponse.status).json(errorResponse);
  }
}
