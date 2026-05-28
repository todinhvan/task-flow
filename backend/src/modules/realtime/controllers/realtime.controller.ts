import { IsPublic } from '@/shared/decorators/auth.decorator';
import { TokenProvider } from '@/shared/providers/token.provider';
import {
  Controller,
  Get,
  Query,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { RealtimeService } from '../services/realtime.service';
import { RealtimeServerEvent } from '../types/realtime-event.type';

@Controller('realtime')
export class RealtimeController {
  constructor(
    private readonly realtimeService: RealtimeService,
    private readonly tokenProvider: TokenProvider,
  ) {}

  @Get('stream')
  @IsPublic()
  async stream(
    @Query('token') token: string | string[] | undefined,
    @Req() request: Request,
    @Res() response: Response,
  ) {
    const accessToken = Array.isArray(token) ? token[0] : token;
    if (!accessToken?.trim()) {
      throw new UnauthorizedException('Missing access token');
    }

    const payload = await this.tokenProvider.verifyAccessToken(accessToken.trim()).catch(() => {
      throw new UnauthorizedException('Invalid or expired access token');
    });

    response.setHeader('Content-Type', 'text/event-stream');
    response.setHeader('Cache-Control', 'no-cache, no-transform');
    response.setHeader('Connection', 'keep-alive');
    response.setHeader('X-Accel-Buffering', 'no');
    response.flushHeaders?.();

    const writeEvent = (event: RealtimeServerEvent) => {
      response.write(`event: ${event.type}\n`);
      response.write(`data: ${JSON.stringify(event)}\n\n`);
    };

    response.write('retry: 5000\n\n');
    writeEvent(this.realtimeService.emitConnected(payload.userId));

    const unsubscribe = this.realtimeService.subscribe(payload.userId, writeEvent);
    const keepAlive = setInterval(() => {
      response.write(': ping\n\n');
    }, 25000);

    request.on('close', () => {
      clearInterval(keepAlive);
      unsubscribe();
      response.end();
    });
  }
}
