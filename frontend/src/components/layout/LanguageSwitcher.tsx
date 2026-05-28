import { Button } from "@/components/ui/button";
import { useI18n } from "@/context/I18nContext";
import { cn } from "@/lib/utils";

export default function LanguageSwitcher() {
  const { locale, setLocale, t } = useI18n();

  return (
    <div className="inline-flex items-center rounded-full border border-outline-variant/70 bg-surface-container-lowest p-1">
      {(["en", "vi"] as const).map((item) => (
        <Button
          key={item}
          type="button"
          variant="ghost"
          size="sm"
          className={cn(
            "h-8 rounded-full px-3 text-xs uppercase tracking-[0.16em]",
            locale === item && "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground",
          )}
          onClick={() => setLocale(item)}
        >
          {t(`language.${item}`)}
        </Button>
      ))}
    </div>
  );
}
