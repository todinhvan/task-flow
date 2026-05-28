import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsHexColor, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateListRequest {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsHexColor()
  color?: string;
}

export class UpdateListRequest {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsHexColor()
  color?: string;
}

export class ReorderListsRequest {
  @ApiProperty({ type: [String] })
  @IsArray()
  orderedListIds: string[];
}
