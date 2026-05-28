import CaptchaField from "@/components/auth/CaptchaField";
import { getHomePath } from "@/components/auth/ProtectedRoute";
import heroImage from "@/assets/hero.png";
import LanguageSwitcher from "@/components/layout/LanguageSwitcher";
import ThemeToggle from "@/components/layout/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/context/AuthContext";
import { useI18n } from "@/context/I18nContext";
import { captchaConfigured, captchaEnabled } from "@/lib/env";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { z } from "zod";

const loginSchema = z.object({
  email: z.email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const { t } = useI18n();
  const [error, setError] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaResetKey, setCaptchaResetKey] = useState(0);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  async function onSubmit(values: LoginFormValues) {
    try {
      setError(null);
      const session = await login({
        ...values,
        captchaToken: captchaToken ?? undefined,
      });
      const destination =
        (location.state as { from?: string } | null)?.from ??
        getHomePath(session.user.role.code);
      navigate(destination, { replace: true });
    } catch (submitError) {
      setCaptchaResetKey((value) => value + 1);
      setError(
        submitError instanceof Error ? submitError.message : "Login failed",
      );
    }
  }

  return (
    <main className="relative flex min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(0,180,216,0.16),_transparent_34%),linear-gradient(135deg,#f8f9fa,#eef7fb)] dark:bg-[radial-gradient(circle_at_top_left,_rgba(0,180,216,0.12),_transparent_28%),linear-gradient(135deg,#06141a,#0d2229)]">
      <div className="absolute right-4 top-4 z-10 flex items-center gap-2 sm:right-6 sm:top-6">
        <LanguageSwitcher />
        <ThemeToggle />
      </div>

      <section className="relative hidden w-[42%] overflow-hidden border-r border-outline-variant lg:flex">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${heroImage})` }}
        />
        <div className="absolute inset-0 bg-[linear-gradient(160deg,rgba(3,31,39,0.68),rgba(0,103,125,0.55))]" />
      </section>

      <section className="flex flex-1 items-center justify-center p-6 lg:px-10">
        <div className="w-[min(100%,30rem)] rounded-[28px] border border-outline-variant bg-white p-8 shadow-[0_24px_80px_rgba(0,103,125,0.08)] dark:bg-surface-container-lowest">
          <div className="mb-8">
            <p className="text-sm uppercase tracking-[0.2em] text-secondary">
              {t("auth.welcomeBack")}
            </p>
            <h2 className="mt-2 text-3xl font-semibold text-on-surface">
              {t("auth.signIn")}
            </h2>
          </div>

          <form className="space-y-5" onSubmit={form.handleSubmit(onSubmit)}>
            <div>
              <label className="mb-2 block text-sm font-medium text-on-surface">
                {t("auth.email")}
              </label>
              <Input
                type="email"
                placeholder="name@company.com"
                {...form.register("email")}
              />
              {form.formState.errors.email ? (
                <p className="mt-2 text-sm text-error">
                  {form.formState.errors.email.message}
                </p>
              ) : null}
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-on-surface">
                {t("auth.password")}
              </label>
              <Input
                type="password"
                placeholder="Taskflow@123"
                {...form.register("password")}
              />
              {form.formState.errors.password ? (
                <p className="mt-2 text-sm text-error">
                  {form.formState.errors.password.message}
                </p>
              ) : null}
            </div>

            {error ? (
              <div className="rounded-2xl border border-error/20 bg-error/10 px-4 py-3 text-sm text-error">
                {error}
              </div>
            ) : null}

            <CaptchaField
              error={null}
              onChange={setCaptchaToken}
              resetKey={captchaResetKey}
            />

            <Button
              type="submit"
              size="lg"
              className="h-11 w-full rounded-2xl"
              disabled={
                form.formState.isSubmitting ||
                (captchaEnabled && (!captchaConfigured || !captchaToken))
              }
            >
              {form.formState.isSubmitting
                ? t("auth.signingIn")
                : t("auth.signIn")}
            </Button>
          </form>

          <p className="mt-6 text-sm text-on-surface-variant">
            {t("auth.noAccount")}{" "}
            <Link className="font-medium text-primary" to="/register">
              {t("auth.registerHere")}
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
