import { emptyStringToNull, emptyStringToUndefined, shouldValidateDefined } from '@/shared/utils/transform.util';
import { RoleCode, UserStatus } from '@/generated/prisma/enums';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  ValidateIf,
  MaxLength,
  MinLength,
} from 'class-validator';

export class ListUsersQuery {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: RoleCode })
  @IsOptional()
  @IsEnum(RoleCode)
  roleCode?: RoleCode;

  @ApiPropertyOptional({ enum: UserStatus })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;
}

export class CreateUserRequest {
  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiProperty()
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty({ enum: RoleCode })
  @IsEnum(RoleCode)
  roleCode: RoleCode;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  fullName: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => emptyStringToUndefined(value))
  @IsString()
  phoneNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => emptyStringToUndefined(value))
  @IsString()
  jobTitle?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => emptyStringToUndefined(value))
  @IsString()
  department?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => emptyStringToUndefined(value))
  @IsString()
  bio?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => emptyStringToUndefined(value))
  @IsString()
  location?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => emptyStringToUndefined(value))
  @IsDateString()
  dateOfBirth?: string;
}

export class UpdateUserRequest {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => emptyStringToUndefined(value))
  @ValidateIf(shouldValidateDefined)
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @Transform(({ value }) => emptyStringToUndefined(value))
  @ValidateIf(shouldValidateDefined)
  @IsString()
  @MinLength(8)
  password?: string;

  @ApiPropertyOptional({ enum: RoleCode })
  @IsOptional()
  @IsEnum(RoleCode)
  roleCode?: RoleCode;

  @ApiPropertyOptional({ enum: UserStatus })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

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
