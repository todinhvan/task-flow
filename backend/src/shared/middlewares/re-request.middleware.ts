import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { MetadataKey } from '../constants/common.constant';
import { generateRequestId } from '../utils/string.util';

@Injectable()
export class ReRequestMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const requestId = generateRequestId();
    const startTime = Date.now();

    req[MetadataKey.RequestId] = requestId;
    req[MetadataKey.StartTime] = startTime;

    Logger.log(`HTTP >> [${req.method} ${req.originalUrl}] >> '${requestId}' at '${startTime}'.`);

    next();
  }
}
