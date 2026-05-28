import { PanelLeftIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/context/I18nContext";
import LanguageSwitcher from "./LanguageSwitcher";
import ThemeToggle from "./ThemeToggle";
import UserAccountMenu from "./UserAccountMenu";

export default function AdminTopBar({
  onOpenNavigation,
}: {
  onOpenNavigation: () => void;
}) {
  const { t } = useI18n();

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-outline-variant/80 bg-surface-container-lowest/95 px-4 backdrop-blur sm:px-6 lg:px-8">
      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="lg:hidden"
          onClick={onOpenNavigation}
        >
          <PanelLeftIcon className="size-5" />
          <span className="sr-only">{t("nav.openNavigation")}</span>
        </Button>
        <span className="text-lg font-semibold tracking-tight text-on-surface">
          TaskFlow
        </span>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <LanguageSwitcher />
        <ThemeToggle />
        <UserAccountMenu />
      </div>
    </header>
  );
}
