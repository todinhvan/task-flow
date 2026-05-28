import { useEffect, useRef } from "react";
import ReCAPTCHA from "react-google-recaptcha";
import { captchaConfigured, captchaEnabled, recaptchaSiteKey } from "@/lib/env";

type CaptchaFieldProps = {
  error?: string | null;
  onChange: (token: string | null) => void;
  resetKey?: number;
};

export default function CaptchaField({
  error,
  onChange,
  resetKey = 0,
}: CaptchaFieldProps) {
  const recaptchaRef = useRef<ReCAPTCHA | null>(null);

  useEffect(() => {
    if (!captchaEnabled) {
      return;
    }

    recaptchaRef.current?.reset();
    onChange(null);
  }, [onChange, resetKey]);

  if (!captchaEnabled) {
    return null;
  }

  if (!captchaConfigured) {
    return (
      <div className="rounded-2xl border border-error/20 bg-error/10 px-4 py-3 text-sm text-error">
        reCAPTCHA is enabled but `VITE_RECAPTCHA_SITE_KEY` is missing.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <ReCAPTCHA
        ref={recaptchaRef}
        sitekey={recaptchaSiteKey}
        onChange={onChange}
        onExpired={() => onChange(null)}
      />
      {error ? (
        <p className="text-sm text-error">{error}</p>
      ) : null}
    </div>
  );
}
