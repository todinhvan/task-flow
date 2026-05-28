import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { BootstrapProvider } from './providers/bootstrap.provider';
import { CaptchaProvider } from './providers/captcha.provider';
import { CloudinaryProvider } from './providers/cloudinary.provider';
import { HashingProvider } from './providers/hashing.provider';
import { PrismaProvider } from './providers/prisma.provider';
import { TokenProvider } from './providers/token.provider';
import { WorkspaceProvisionProvider } from './providers/workspace-provision.provider';

const providers = [
  PrismaProvider,
  HashingProvider,
  TokenProvider,
  CaptchaProvider,
  CloudinaryProvider,
  WorkspaceProvisionProvider,
  BootstrapProvider,
];

@Global()
@Module({
  imports: [JwtModule],
  providers: [...providers],
  exports: [...providers],
})
export class SharedModule {}
