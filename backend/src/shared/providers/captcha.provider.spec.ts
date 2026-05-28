import { BadRequestException, InternalServerErrorException, UnauthorizedException } from '@nestjs/common';
import envConfig from '@/config';
import { CaptchaProvider } from './captcha.provider';

describe('CaptchaProvider', () => {
  const provider = new CaptchaProvider();
  const originalConfig = {
    SecurityEnableCaptcha: envConfig.SecurityEnableCaptcha,
    RecaptchaSecretKey: envConfig.RecaptchaSecretKey,
    RecaptchaSiteKey: envConfig.RecaptchaSiteKey,
    RecaptchaExpectedHostname: envConfig.RecaptchaExpectedHostname,
  };

  beforeEach(() => {
    jest.restoreAllMocks();
    envConfig.SecurityEnableCaptcha = true;
    envConfig.RecaptchaSecretKey = 'secret-key';
    envConfig.RecaptchaSiteKey = 'site-key';
    envConfig.RecaptchaExpectedHostname = 'localhost';
  });

  afterAll(() => {
    envConfig.SecurityEnableCaptcha = originalConfig.SecurityEnableCaptcha;
    envConfig.RecaptchaSecretKey = originalConfig.RecaptchaSecretKey;
    envConfig.RecaptchaSiteKey = originalConfig.RecaptchaSiteKey;
    envConfig.RecaptchaExpectedHostname = originalConfig.RecaptchaExpectedHostname;
  });

  it('short-circuits when captcha is disabled', async () => {
    envConfig.SecurityEnableCaptcha = false;

    await expect(provider.verifyOrThrow(undefined)).resolves.toBeUndefined();
  });

  it('rejects missing captcha tokens', async () => {
    await expect(provider.verifyOrThrow(undefined)).rejects.toThrow(BadRequestException);
  });

  it('verifies captcha tokens on the happy path', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        hostname: 'localhost',
      }),
    }) as any;

    await expect(provider.verifyOrThrow('captcha-token', '127.0.0.1')).resolves.toBeUndefined();
  });

  it('rejects upstream verification failures', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: false,
      }),
    }) as any;

    await expect(provider.verifyOrThrow('captcha-token')).rejects.toThrow(UnauthorizedException);
  });

  it('rejects unavailable captcha verification', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
    }) as any;

    await expect(provider.verifyOrThrow('captcha-token')).rejects.toThrow(InternalServerErrorException);
  });
});
