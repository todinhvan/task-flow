import envConfig from '@/config';
import { BadRequestException, Injectable, InternalServerErrorException, UnauthorizedException } from '@nestjs/common';

type RecaptchaVerifyResponse = {
  success: boolean;
  challenge_ts?: string;
  hostname?: string;
  'error-codes'?: string[];
};

@Injectable()
export class CaptchaProvider {
  isEnabled() {
    return envConfig.SecurityEnableCaptcha;
  }

  async verifyOrThrow(token: string | undefined, remoteIp?: string) {
    if (!this.isEnabled()) {
      return;
    }

    this.ensureConfigured();

    if (!token || token.trim().length === 0) {
      throw new BadRequestException('Captcha token is required');
    }

    const payload = new URLSearchParams({
      secret: envConfig.RecaptchaSecretKey!,
      response: token.trim(),
    });

    if (remoteIp) {
      payload.set('remoteip', remoteIp);
    }

    const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: payload.toString(),
    });

    if (!response.ok) {
      throw new InternalServerErrorException('Captcha verification is unavailable');
    }

    const result = (await response.json()) as RecaptchaVerifyResponse;
    if (!result.success) {
      throw new UnauthorizedException('Captcha verification failed');
    }

    if (
      envConfig.RecaptchaExpectedHostname &&
      result.hostname &&
      result.hostname !== envConfig.RecaptchaExpectedHostname
    ) {
      throw new UnauthorizedException('Captcha hostname mismatch');
    }
  }

  private ensureConfigured() {
    if (!envConfig.RecaptchaSecretKey || !envConfig.RecaptchaSiteKey) {
      throw new InternalServerErrorException('Captcha is enabled but not configured');
    }
  }
}
