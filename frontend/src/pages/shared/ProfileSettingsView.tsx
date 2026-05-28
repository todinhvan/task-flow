import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { Link } from "react-router-dom";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/context/AuthContext";
import { useI18n } from "@/context/I18nContext";
import { api, unwrapEnvelope } from "@/lib/api";
import { resizeImageFile } from "@/lib/files";
import type { Profile } from "@/types/api";

const profileSchema = z.object({
  fullName: z.string().min(2, "Full name must be at least 2 characters"),
  phoneNumber: z.string().optional(),
  jobTitle: z.string().optional(),
  department: z.string().optional(),
  location: z.string().optional(),
  dateOfBirth: z.string().optional(),
  bio: z.string().optional(),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

export default function ProfileSettingsView({
  backHref,
  backLabel,
  title,
  subtitle,
}: {
  backHref?: string;
  backLabel?: string;
  title: string;
  subtitle: string;
}) {
  const { refreshUser, user } = useAuth();
  const { t } = useI18n();
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(
    user?.profile.avatarUrl ?? null,
  );
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      fullName: "",
      phoneNumber: "",
      jobTitle: "",
      department: "",
      location: "",
      dateOfBirth: "",
      bio: "",
    },
  });

  useEffect(() => {
    async function loadProfile() {
      const response = await api.get("/profiles/me");
      const payload = unwrapEnvelope<{
        id: string;
        email: string;
        role: { id: string; code: string; name: string };
        profile: Profile;
      }>(response.data);

      form.reset({
        fullName: payload.profile.fullName ?? "",
        phoneNumber: payload.profile.phoneNumber ?? "",
        jobTitle: payload.profile.jobTitle ?? "",
        department: payload.profile.department ?? "",
        location: payload.profile.location ?? "",
        dateOfBirth: payload.profile.dateOfBirth
          ? payload.profile.dateOfBirth.slice(0, 10)
          : "",
        bio: payload.profile.bio ?? "",
      });
      setAvatarPreview(payload.profile.avatarUrl ?? null);
    }

    void loadProfile();
  }, [form]);

  async function onAvatarChange(file: File | null) {
    if (!file) {
      return;
    }

    try {
      const resized = await resizeImageFile(file, {
        maxWidth: 512,
        maxHeight: 512,
      });
      setAvatarFile(resized);
      setAvatarPreview(URL.createObjectURL(resized));
      setError(null);
    } catch (fileError) {
      setError(fileError instanceof Error ? fileError.message : "Invalid image");
    }
  }

  async function onSubmit(values: ProfileFormValues) {
    try {
      setError(null);
      setStatus(null);

      const formData = new FormData();
      appendNullableTextFields(formData, values, [
        "phoneNumber",
        "jobTitle",
        "department",
        "location",
        "dateOfBirth",
        "bio",
      ]);

      if (avatarFile) {
        formData.append("avatar", avatarFile);
      }

      await api.patch("/profiles/me", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });
      await refreshUser();
      setStatus(t("profile.updated"));
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : t("profile.updateError"),
      );
    }
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <div>
        {backHref && backLabel ? (
          <Link
            to={backHref}
            className="inline-flex items-center rounded-2xl border border-outline-variant px-4 py-2 text-sm font-medium text-on-surface transition hover:bg-surface-container-low"
          >
            {backLabel}
          </Link>
        ) : null}
        <h1 className="text-3xl font-semibold text-on-surface">{title}</h1>
        <p className="mt-2 text-sm text-on-surface-variant">{subtitle}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <section className="rounded-[28px] border border-outline-variant bg-surface-container-lowest p-6">
          <div className="flex flex-col items-center">
            <div className="size-36 overflow-hidden rounded-full border border-outline-variant bg-surface-container">
              {avatarPreview ? (
                <img
                  src={avatarPreview}
                  alt={t("profile.avatarPreviewAlt")}
                  className="size-full object-cover"
                />
              ) : (
                <div className="flex size-full items-center justify-center text-4xl font-semibold text-secondary">
                  {user?.profile.fullName.slice(0, 2).toUpperCase()}
                </div>
              )}
            </div>
            <label className="mt-4 inline-flex cursor-pointer items-center rounded-2xl border border-outline-variant px-4 py-2 text-sm font-medium text-on-surface transition hover:bg-surface-container-low">
              {t("profile.uploadAvatar")}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(event) =>
                  void onAvatarChange(event.target.files?.[0] ?? null)
                }
              />
            </label>
            <p className="mt-3 text-center text-xs text-secondary">
              {t("profile.uploadHint")}
            </p>
          </div>
        </section>

        <section className="rounded-[28px] border border-outline-variant bg-surface-container-lowest p-6">
          <form className="space-y-5" onSubmit={form.handleSubmit(onSubmit)}>
            <div className="grid gap-5 md:grid-cols-2">
              <Field
                label={t("auth.fullName")}
                error={form.formState.errors.fullName?.message}
              >
                <Input {...form.register("fullName")} />
              </Field>
              <Field
                label={t("profile.phoneNumber")}
                error={form.formState.errors.phoneNumber?.message}
              >
                <Input {...form.register("phoneNumber")} />
              </Field>
              <Field
                label={t("profile.jobTitle")}
                error={form.formState.errors.jobTitle?.message}
              >
                <Input {...form.register("jobTitle")} />
              </Field>
              <Field
                label={t("profile.department")}
                error={form.formState.errors.department?.message}
              >
                <Input {...form.register("department")} />
              </Field>
              <Field
                label={t("profile.location")}
                error={form.formState.errors.location?.message}
              >
                <Input {...form.register("location")} />
              </Field>
              <Field
                label={t("profile.dateOfBirth")}
                error={form.formState.errors.dateOfBirth?.message}
              >
                <Input type="date" {...form.register("dateOfBirth")} />
              </Field>
            </div>

            <Field label={t("profile.bio")} error={form.formState.errors.bio?.message}>
              <textarea
                className="min-h-32 w-full rounded-2xl border border-outline-variant bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-ring focus:ring-3 focus:ring-ring/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                {...form.register("bio")}
              />
            </Field>

            {status ? (
              <div className="rounded-2xl border border-primary/20 bg-primary/10 px-4 py-3 text-sm text-primary">
                {status}
              </div>
            ) : null}

            {error ? (
              <div className="rounded-2xl border border-error/20 bg-error/10 px-4 py-3 text-sm text-error">
                {error}
              </div>
            ) : null}

            <div className="flex justify-end">
              <Button
                type="submit"
                size="lg"
                className="h-11 rounded-2xl px-6"
                disabled={form.formState.isSubmitting}
              >
                {form.formState.isSubmitting ? t("common.saving") : t("common.saveChanges")}
              </Button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}

function appendNullableTextFields(
  formData: FormData,
  values: Record<string, string>,
  nullableKeys: string[],
) {
  const nullableKeySet = new Set(nullableKeys);

  Object.entries(values).forEach(([key, value]) => {
    if (nullableKeySet.has(key)) {
      formData.append(key, value ?? "");
      return;
    }

    if (value) {
      formData.append(key, value);
    }
  });
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-on-surface">
        {label}
      </label>
      {children}
      {error ? <p className="mt-2 text-sm text-error">{error}</p> : null}
    </div>
  );
}
