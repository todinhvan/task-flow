function toBoolean(value: string | undefined, defaultValue = false) {
  if (value === undefined || value.trim().length === 0) {
    return defaultValue;
  }

  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

export const captchaEnabled = toBoolean(import.meta.env.VITE_ENABLE_CAPTCHA);
export const recaptchaSiteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY?.trim() ?? "";
export const captchaConfigured = !captchaEnabled || recaptchaSiteKey.length > 0;
