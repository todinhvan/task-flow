import { HttpMessage } from '@/shared/constants/common.constant';
import { HttpStatus } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';

export class ResponseApi<T> {
  @ApiProperty({ type: Number })
  status: HttpStatus;

  @ApiProperty()
  message: string;

  @ApiProperty()
  data?: T;

  @ApiProperty()
  requestId?: string;

  @ApiProperty()
  duration?: string;

  static success<T>({
    data,
    message = HttpMessage.Ok,
    status = HttpStatus.OK,
  }: {
    data: T;
    message?: string;
    status?: HttpStatus;
  }): ResponseApi<T> {
    const response = new ResponseApi<T>();
    response.status = status;
    response.message = message;
    response.data = data;
    return response;
  }
}

export class ErrorResponse<T> {
  @ApiProperty({ type: Number })
  status: HttpStatus = HttpStatus.INTERNAL_SERVER_ERROR;

  @ApiProperty()
  message: string = HttpMessage.InternalServerError;

  @ApiProperty()
  error?: T;

  @ApiProperty()
  requestId: string;

  @ApiProperty()
  duration: string;
}
