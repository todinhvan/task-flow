import { emptyStringToNull, shouldValidateDefined } from '@/shared/utils/transform.util';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsDateString, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ValidateIf } from 'class-validator';

export class UpdateProfileRequest {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  fullName?: string;

  @ApiPropertyOptional()
  @Transform(({ value }) => emptyStringToNull(value))
  @ValidateIf(shouldValidateDefined)
  @IsString()
  phoneNumber?: string | null;

  @ApiPropertyOptional()
  @Transform(({ value }) => emptyStringToNull(value))
  @ValidateIf(shouldValidateDefined)
  @IsString()
  jobTitle?: string | null;

  @ApiPropertyOptional()
  @Transform(({ value }) => emptyStringToNull(value))
  @ValidateIf(shouldValidateDefined)
  @IsString()
  department?: string | null;

  @ApiPropertyOptional()
  @Transform(({ value }) => emptyStringToNull(value))
  @ValidateIf(shouldValidateDefined)
  @IsString()
  bio?: string | null;

  @ApiPropertyOptional()
  @Transform(({ value }) => emptyStringToNull(value))
  @ValidateIf(shouldValidateDefined)
  @IsString()
  location?: string | null;

  @ApiPropertyOptional()
  @Transform(({ value }) => emptyStringToNull(value))
  @ValidateIf(shouldValidateDefined)
  @IsDateString()
  dateOfBirth?: string | null;
}
