import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { ResponseApi } from '../interfaces/common/response.interface';
import { RequestWithMetadata } from '../types/request.type';

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<RequestWithMetadata>();
    const { method, originalUrl, requestId, startTime } = request;

    return next.handle().pipe(
      tap(() => {
        Logger.log(
          `HTTP(Success) >> [${method} ${originalUrl}] >> '${requestId}'. Duration: ${Date.now() - startTime}ms`,
        );
      }),
      map((response: ResponseApi<unknown> | undefined | null) => {
        if (!response || typeof response !== 'object') {
          return response;
        }

        response.requestId = requestId;
        response.duration = `${Date.now() - startTime}ms`;
        return response;
      }),
    );
  }
}
