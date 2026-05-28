import ProfileSettingsView from "@/pages/shared/ProfileSettingsView";
import { useAuth } from "@/context/AuthContext";
import { useI18n } from "@/context/I18nContext";

export default function ManageProfilePage() {
  const { user } = useAuth();
  const { t } = useI18n();

  const title =
    user?.role.code === "MANAGER"
      ? t("profile.managerTitle")
      : t("profile.adminTitle");
  const subtitle =
    user?.role.code === "MANAGER"
      ? t("profile.managerSubtitle")
      : t("profile.adminSubtitle");

  return <ProfileSettingsView title={title} subtitle={subtitle} />;
}
