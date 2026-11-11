import type { MessageKey } from "@/lib/i18n/messages";
import { useT } from "@/lib/i18n/context";

export function PermitCard({
  title,
  body,
  denied,
  onAllow,
  onLater,
  onSettings,
}: {
  title: MessageKey;
  body: MessageKey;
  denied?: boolean;
  onAllow: () => void;
  onLater: () => void;
  onSettings: () => void;
}) {
  const t = useT();
  return (
    <div className="space-y-3 rounded-2xl border border-border2 bg-card px-4 py-4 text-foreground">
      <h3 className="text-sm font-bold">{t(title)}</h3>
      <p className="text-sm leading-relaxed text-muted-foreground">{t(body)}</p>
      {denied ? (
        <button type="button" className="h-11 w-full rounded-xl bg-primary text-sm font-semibold text-primary-foreground" onClick={onSettings}>
          {t("permit.settings")}
        </button>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <button type="button" className="h-11 rounded-xl border border-border2 text-sm font-semibold" onClick={onLater}>
            {t("permit.notNow")}
          </button>
          <button type="button" className="h-11 rounded-xl bg-primary text-sm font-semibold text-primary-foreground" onClick={onAllow}>
            {t("permit.allow")}
          </button>
        </div>
      )}
    </div>
  );
}
