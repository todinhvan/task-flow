import ProfileSettingsView from "@/pages/shared/ProfileSettingsView";
import { useI18n } from "@/context/I18nContext";

export default function ManagerProfilePage() {
  const { t } = useI18n();

  return (
    <ProfileSettingsView
      title={t("profile.managerTitle")}
      subtitle={t("profile.managerSubtitle")}
    />
  );
}
