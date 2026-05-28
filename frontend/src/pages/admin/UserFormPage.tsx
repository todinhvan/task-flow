import { zodResolver } from "@hookform/resolvers/zod";
import {
  useEffect,
  useMemo,
  useState,
  type ReactNode,
  type SelectHTMLAttributes,
} from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate, useParams } from "react-router-dom";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/context/I18nContext";
import { api, unwrapEnvelope } from "@/lib/api";
import { resizeImageFile } from "@/lib/files";
import type { RoleSummary, UserStatus, UserSummary } from "@/types/api";

const userSchema = z.object({
  fullName: z.string().min(2, "Full name must be at least 2 characters"),
  email: z.email("Enter a valid email address"),
  password: z.string().optional(),
  roleCode: z.string().min(1, "Select a role"),
  status: z.enum(["ACTIVE", "INACTIVE", "BLOCKED"]),
  phoneNumber: z.string().optional(),
  jobTitle: z.string().optional(),
  department: z.string().optional(),
  location: z.string().optional(),
  dateOfBirth: z.string().optional(),
  bio: z.string().optional(),
});

type UserFormValues = z.infer<typeof userSchema>;

export default function UserFormPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const params = useParams();
  const userId = params.id;
  const isEdit = Boolean(userId);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [roles, setRoles] = useState<RoleSummary[]>([]);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<UserFormValues>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      fullName: "",
      email: "",
      password: "",
      roleCode: "EMPLOYEE",
      status: "ACTIVE",
      phoneNumber: "",
      jobTitle: "",
      department: "",
      location: "",
      dateOfBirth: "",
      bio: "",
    },
  });

  useEffect(() => {
    async function loadRoles() {
      const response = await api.get("/roles", {
        params: {
          includeInactive: true,
        },
      });
      setRoles(unwrapEnvelope<RoleSummary[]>(response.data));
    }

    void loadRoles();
  }, []);

  useEffect(() => {
    if (!isEdit || !userId) {
      return;
    }

    async function loadUser() {
      const response = await api.get(`/users/${userId}`);
      const user = unwrapEnvelope<UserSummary>(response.data);
      form.reset({
        fullName: user.profile.fullName,
        email: user.email,
        password: "",
        roleCode: user.role.code,
        status: user.status,
        phoneNumber: user.profile.phoneNumber ?? "",
        jobTitle: user.profile.jobTitle ?? "",
        department: user.profile.department ?? "",
        location: user.profile.location ?? "",
        dateOfBirth: user.profile.dateOfBirth
          ? user.profile.dateOfBirth.slice(0, 10)
          : "",
        bio: user.profile.bio ?? "",
      });
      setAvatarPreview(user.profile.avatarUrl ?? null);
    }

    void loadUser();
  }, [form, isEdit, userId]);

  const roleOptions = useMemo(
    () =>
      roles
        .filter((role) => role.isActive || role.code === form.getValues("roleCode"))
        .map((role) => ({
          value: role.code,
          label: role.isActive ? role.name : `${role.name} (${t("status.inactive")})`,
        })),
    [form, roles],
  );

  async function handleAvatar(file: File | null) {
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

  async function onSubmit(values: UserFormValues) {
    try {
      setError(null);

      if (!isEdit && (!values.password || values.password.length < 8)) {
        setError("Password must be at least 8 characters");
        return;
      }

      const formData = new FormData();
      const nullableKeys = new Set([
        "phoneNumber",
        "jobTitle",
        "department",
        "location",
        "dateOfBirth",
        "bio",
      ]);

      Object.entries(values).forEach(([key, value]) => {
        if (key === "password" && isEdit && !value) {
          return;
        }

        if (nullableKeys.has(key)) {
          formData.append(key, value ?? "");
          return;
        }

        if (value) {
          formData.append(key, value);
        }
      });

      if (avatarFile) {
        formData.append("avatar", avatarFile);
      }

      if (isEdit && userId) {
        await api.patch(`/users/${userId}`, formData, {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        });
      } else {
        await api.post("/users", formData, {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        });
      }

      navigate("/admin/users");
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Unable to save user",
      );
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <Link
          to="/admin/users"
          className="text-sm font-medium text-primary transition hover:opacity-80"
        >
          {t("users.title")}
        </Link>
        <h1 className="mt-3 text-3xl font-semibold text-on-surface">
          {isEdit ? t("users.editDialogTitle") : t("users.createDialogTitle")}
        </h1>
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
                  {form.watch("fullName").slice(0, 2).toUpperCase() || "US"}
                </div>
              )}
            </div>
            <label className="mt-4 inline-flex cursor-pointer items-center rounded-2xl border border-outline-variant px-4 py-2 text-sm font-medium text-on-surface transition hover:bg-surface-container-low">
              {t("users.uploadAvatar")}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(event) =>
                  void handleAvatar(event.target.files?.[0] ?? null)
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
              <Field label={t("auth.fullName")} error={form.formState.errors.fullName?.message}>
                <Input {...form.register("fullName")} />
              </Field>
              <Field label={t("auth.email")} error={form.formState.errors.email?.message}>
                <Input type="email" {...form.register("email")} />
              </Field>
              <Field
                label={isEdit ? t("users.newPassword") : t("common.password")}
                error={form.formState.errors.password?.message}
              >
                <Input type="password" {...form.register("password")} />
              </Field>
              <SelectField
                label={t("users.role")}
                error={form.formState.errors.roleCode?.message}
                {...form.register("roleCode")}
                options={roleOptions}
              />
              <SelectField
                label={t("users.status")}
                error={form.formState.errors.status?.message}
                {...form.register("status")}
                options={["ACTIVE", "INACTIVE", "BLOCKED"]}
              />
              <Field
                label={t("users.phoneNumber")}
                error={form.formState.errors.phoneNumber?.message}
              >
                <Input {...form.register("phoneNumber")} />
              </Field>
              <Field label={t("users.jobTitle")} error={form.formState.errors.jobTitle?.message}>
                <Input {...form.register("jobTitle")} />
              </Field>
              <Field
                label={t("users.department")}
                error={form.formState.errors.department?.message}
              >
                <Input {...form.register("department")} />
              </Field>
              <Field label={t("users.location")} error={form.formState.errors.location?.message}>
                <Input {...form.register("location")} />
              </Field>
              <Field
                label={t("users.dateOfBirth")}
                error={form.formState.errors.dateOfBirth?.message}
              >
                <Input type="date" {...form.register("dateOfBirth")} />
              </Field>
            </div>

            <Field label={t("users.bio")} error={form.formState.errors.bio?.message}>
              <textarea
                className="min-h-32 w-full rounded-2xl border border-outline-variant bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-ring focus:ring-3 focus:ring-ring/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                {...form.register("bio")}
              />
            </Field>

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
                {form.formState.isSubmitting ? t("common.saving") : t("users.saveUser")}
              </Button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
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

function SelectField({
  label,
  error,
  options,
  ...props
}: {
  label: string;
  error?: string;
  options: Array<UserStatus | { value: string; label: string }>;
} & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-on-surface">
        {label}
      </label>
      <select
        className="h-8 w-full rounded-2xl border border-outline-variant bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-ring focus:ring-3 focus:ring-ring/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        {...props}
      >
        {options.map((option) => (
          <option
            key={typeof option === "string" ? option : option.value}
            value={typeof option === "string" ? option : option.value}
          >
            {typeof option === "string" ? option : option.label}
          </option>
        ))}
      </select>
      {error ? <p className="mt-2 text-sm text-error">{error}</p> : null}
    </div>
  );
}
