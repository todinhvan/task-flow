import { MoonIcon, SunIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/context/ThemeContext";
import { useI18n } from "@/context/I18nContext";

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const { t } = useI18n();

  const isDark = theme === "dark";

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="rounded-full border border-outline-variant/70 bg-surface-container-lowest"
      onClick={toggleTheme}
      title={t(isDark ? "theme.light" : "theme.dark")}
    >
      {isDark ? <SunIcon className="size-4" /> : <MoonIcon className="size-4" />}
      <span className="sr-only">{t(isDark ? "theme.light" : "theme.dark")}</span>
    </Button>
  );
}
