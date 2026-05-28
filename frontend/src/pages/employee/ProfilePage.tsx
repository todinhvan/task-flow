import ProfileSettingsView from "@/pages/shared/ProfileSettingsView";
import { useI18n } from "@/context/I18nContext";

export default function EmployeeProfilePage() {
  const { t } = useI18n();

  return (
    <ProfileSettingsView
      backHref="/board"
      backLabel="Back to board"
      title={t("profile.employeeTitle")}
      subtitle={t("profile.employeeSubtitle")}
    />
  );
}
