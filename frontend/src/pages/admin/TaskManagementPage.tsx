import { Link } from "react-router-dom";
import { useI18n } from "@/context/I18nContext";

export default function TaskManagementPage() {
  const { t } = useI18n();

  return (
    <div className="rounded-[28px] border border-outline-variant bg-surface-container-lowest p-6">
      <h1 className="text-3xl font-semibold text-on-surface">{t("tasks.title")}</h1>
      <p className="mt-3 text-sm text-on-surface-variant">
        {t("tasks.subtitle")}
      </p>
      <Link
        to="/manager/tasks"
        className="mt-5 inline-flex rounded-2xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
      >
        {t("tasks.title")}
      </Link>
    </div>
  );
}
