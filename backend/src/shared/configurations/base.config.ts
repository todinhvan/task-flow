import { IsBoolean, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class BaseConfiguration {
  @IsString()
  @IsNotEmpty()
  NodeEnv: string;

  @IsString()
  @IsNotEmpty()
  Host: string;

  @IsNumber()
  @IsNotEmpty()
  Port: number;

  @IsString()
  @IsNotEmpty()
  GlobalPrefix: string;

  @IsString()
  @IsNotEmpty()
  DatabaseUrl: string;

  @IsString()
  @IsNotEmpty()
  ClientUrl: string;

  @IsString()
  @IsNotEmpty()
  JwtATSecret: string;

  @IsString()
  @IsNotEmpty()
  JwtATExpiration: string;

  @IsString()
  @IsNotEmpty()
  JwtRTSecret: string;

  @IsString()
  @IsNotEmpty()
  JwtRTExpiration: string;

  @IsString()
  @IsNotEmpty()
  ApiKeySecret: string;

  @IsNumber()
  @IsNotEmpty()
  SaltRounds: number;

  @IsOptional()
  @IsString()
  CloudinaryCloudName?: string;

  @IsOptional()
  @IsString()
  CloudinaryApiKey?: string;

  @IsOptional()
  @IsString()
  CloudinaryApiSecret?: string;

  @IsNumber()
  @IsNotEmpty()
  AvatarMaxFileSizeMb: number;

  @IsNumber()
  @IsNotEmpty()
  AttachmentMaxFileSizeMb: number;

  @IsBoolean()
  SecurityEnableCaptcha: boolean;

  @IsBoolean()
  SecurityEnableRateLimit: boolean;

  @IsOptional()
  @IsString()
  RecaptchaSiteKey?: string;

  @IsOptional()
  @IsString()
  RecaptchaSecretKey?: string;

  @IsOptional()
  @IsString()
  RecaptchaExpectedHostname?: string;

  @IsNumber()
  @IsNotEmpty()
  GlobalRateLimitTtlSeconds: number;

  @IsNumber()
  @IsNotEmpty()
  GlobalRateLimitMax: number;

  @IsNumber()
  @IsNotEmpty()
  AuthRateLimitTtlSeconds: number;

  @IsNumber()
  @IsNotEmpty()
  AuthRateLimitMax: number;

  @IsNumber()
  @IsNotEmpty()
  UploadRateLimitTtlSeconds: number;

  @IsNumber()
  @IsNotEmpty()
  UploadRateLimitMax: number;

  @IsNumber()
  @IsNotEmpty()
  JsonBodyLimitMb: number;

  @IsNumber()
  @IsNotEmpty()
  UrlencodedBodyLimitMb: number;

  constructor() {
    this.NodeEnv = process.env.NODE_ENV || '';
    this.Host = process.env.HOST || '';
    this.Port = Number(process.env.PORT);
    this.GlobalPrefix = process.env.GLOBAL_PREFIX || '';
    this.DatabaseUrl = process.env.DATABASE_URL || '';
    this.ClientUrl = process.env.CLIENT_URL || '';
    this.JwtATSecret = process.env.JWT_AT_SECRET || '';
    this.JwtATExpiration = process.env.JWT_AT_EXPIRATION_TIME || '';
    this.JwtRTSecret = process.env.JWT_RT_SECRET || '';
    this.JwtRTExpiration = process.env.JWT_RT_EXPIRATION_TIME || '';
    this.ApiKeySecret = process.env.API_KEY_SECRET || '';
    this.SaltRounds = Number(process.env.SALT_OR_ROUNDS);
    this.CloudinaryCloudName = process.env.CLOUDINARY_CLOUD_NAME || '';
    this.CloudinaryApiKey = process.env.CLOUDINARY_API_KEY || '';
    this.CloudinaryApiSecret = process.env.CLOUDINARY_API_SECRET || '';
    this.AvatarMaxFileSizeMb = Number(process.env.AVATAR_MAX_FILE_SIZE_MB || 2);
    this.AttachmentMaxFileSizeMb = Number(process.env.ATTACHMENT_MAX_FILE_SIZE_MB || 10);
    this.SecurityEnableCaptcha = toBoolean(process.env.SECURITY_ENABLE_CAPTCHA, false);
    this.SecurityEnableRateLimit = toBoolean(process.env.SECURITY_ENABLE_RATE_LIMIT, true);
    this.RecaptchaSiteKey = process.env.RECAPTCHA_SITE_KEY || '';
    this.RecaptchaSecretKey = process.env.RECAPTCHA_SECRET_KEY || '';
    this.RecaptchaExpectedHostname = process.env.RECAPTCHA_EXPECTED_HOSTNAME || '';
    this.GlobalRateLimitTtlSeconds = Number(process.env.GLOBAL_RATE_LIMIT_TTL_SECONDS || 60);
    this.GlobalRateLimitMax = Number(process.env.GLOBAL_RATE_LIMIT_MAX || 120);
    this.AuthRateLimitTtlSeconds = Number(process.env.AUTH_RATE_LIMIT_TTL_SECONDS || 60);
    this.AuthRateLimitMax = Number(process.env.AUTH_RATE_LIMIT_MAX || 5);
    this.UploadRateLimitTtlSeconds = Number(process.env.UPLOAD_RATE_LIMIT_TTL_SECONDS || 60);
    this.UploadRateLimitMax = Number(process.env.UPLOAD_RATE_LIMIT_MAX || 10);
    this.JsonBodyLimitMb = Number(process.env.JSON_BODY_LIMIT_MB || 1);
    this.UrlencodedBodyLimitMb = Number(process.env.URLENCODED_BODY_LIMIT_MB || 1);
  }
}

function toBoolean(value: string | undefined, defaultValue: boolean) {
  if (value === undefined || value.trim().length === 0) {
    return defaultValue;
  }

  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
}
