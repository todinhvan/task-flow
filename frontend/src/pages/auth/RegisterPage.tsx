import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { z } from "zod";
import CaptchaField from "@/components/auth/CaptchaField";
import heroImage from "@/assets/hero.png";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getHomePath } from "@/components/auth/ProtectedRoute";
import { useAuth } from "@/context/AuthContext";
import { useI18n } from "@/context/I18nContext";
import LanguageSwitcher from "@/components/layout/LanguageSwitcher";
import ThemeToggle from "@/components/layout/ThemeToggle";
import { captchaConfigured, captchaEnabled } from "@/lib/env";

const registerSchema = z
  .object({
    fullName: z.string().min(2, "Full name must be at least 2 characters"),
    email: z.email("Enter a valid email address"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(8, "Confirm your password"),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type RegisterFormValues = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const navigate = useNavigate();
  const { register: registerAccount } = useAuth();
  const { t } = useI18n();
  const [error, setError] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaResetKey, setCaptchaResetKey] = useState(0);

  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      fullName: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  async function onSubmit(values: RegisterFormValues) {
    try {
      setError(null);
      const session = await registerAccount({
        ...values,
        captchaToken: captchaToken ?? undefined,
      });
      navigate(getHomePath(session.user.role.code), { replace: true });
    } catch (submitError) {
      setCaptchaResetKey((value) => value + 1);
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Registration failed",
      );
    }
  }

  return (
    <main className="relative flex min-h-screen bg-[linear-gradient(160deg,#f8f9fa_0%,#ffffff_48%,#e8f6fb_100%)] dark:bg-[linear-gradient(160deg,#06141a_0%,#0a1a21_48%,#102731_100%)]">
      <div className="absolute right-4 top-4 z-10 flex items-center gap-2 sm:right-6 sm:top-6">
        <LanguageSwitcher />
        <ThemeToggle />
      </div>

      <section className="relative hidden w-[42%] overflow-hidden border-r border-outline-variant lg:flex">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${heroImage})` }}
        />
        <div className="absolute inset-0 bg-[linear-gradient(160deg,rgba(3,31,39,0.7),rgba(0,103,125,0.6))]" />
      </section>

      <section className="flex flex-1 items-center justify-center p-6 lg:px-10">
        <div className="w-[min(100%,32rem)] rounded-[28px] border border-outline-variant bg-white p-8 shadow-[0_24px_80px_rgba(0,103,125,0.08)] dark:bg-surface-container-lowest">
          <div className="mb-8">
            <p className="text-sm uppercase tracking-[0.2em] text-secondary">
              TaskFlow
            </p>
            <h2 className="mt-2 text-3xl font-semibold text-on-surface">
              {t("auth.register")}
            </h2>
          </div>

          <form
            className="space-y-5"
            onSubmit={form.handleSubmit(onSubmit)}
          >
            <div>
              <label className="mb-2 block text-sm font-medium text-on-surface">
                {t("auth.fullName")}
              </label>
              <Input placeholder="Jane Doe" {...form.register("fullName")} />
              {form.formState.errors.fullName ? (
                <p className="mt-2 text-sm text-error">
                  {form.formState.errors.fullName.message}
                </p>
              ) : null}
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-on-surface">
                {t("auth.email")}
              </label>
              <Input
                type="email"
                placeholder="jane@company.com"
                {...form.register("email")}
              />
              {form.formState.errors.email ? (
                <p className="mt-2 text-sm text-error">
                  {form.formState.errors.email.message}
                </p>
              ) : null}
            </div>

            <div className="grid gap-5 md:grid-cols-2">
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

              <div>
                <label className="mb-2 block text-sm font-medium text-on-surface">
                  {t("auth.confirmPassword")}
                </label>
                <Input
                  type="password"
                  placeholder="Taskflow@123"
                  {...form.register("confirmPassword")}
                />
                {form.formState.errors.confirmPassword ? (
                  <p className="mt-2 text-sm text-error">
                    {form.formState.errors.confirmPassword.message}
                  </p>
                ) : null}
              </div>
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
                (captchaEnabled &&
                  (!captchaConfigured || !captchaToken))
              }
            >
              {form.formState.isSubmitting ? t("auth.creatingAccount") : t("auth.createAccount")}
            </Button>
          </form>

          <p className="mt-6 text-sm text-on-surface-variant">
            {t("auth.alreadyHaveAccount")}{" "}
            <Link className="font-medium text-primary" to="/login">
              {t("auth.signInLink")}
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
