import type { MessageKey } from "@/lib/i18n/messages";
import { useT } from "@/lib/i18n/context";
import { TESTER_APK_URL } from "@/lib/nowmode/install";

const DIFFS = [
  "install.diffReminders",
  "install.diffSound",
  "install.diffVoice",
  "install.diffFiles",
  "install.diffData",
] as const satisfies readonly MessageKey[];

/** Browser vs Android tester. Hidden inside the installed app. */
export function InstallChoice({ onBrowser }: { onBrowser: () => void }) {
  const t = useT();
  if (import.meta.env.VITE_NATIVE === "1") return null;

  return (
    <section className="space-y-3 rounded-2xl border border-border2 bg-card px-4 py-4 text-foreground">
      <h2 className="text-sm font-bold">{t("install.title")}</h2>
      <div className="grid gap-2">
        <button
          type="button"
          onClick={onBrowser}
          className="h-11 rounded-xl bg-primary text-sm font-semibold text-primary-foreground"
        >
          {t("install.browser")}
        </button>
        <a
          href={TESTER_APK_URL}
          className="flex h-11 items-center justify-center rounded-xl border border-border2 bg-background text-sm font-semibold text-foreground"
        >
          {t("install.download")}
        </a>
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">{t("install.note")}</p>
      <p className="text-xs leading-relaxed text-muted-foreground">{t("install.home")}</p>
      <div className="space-y-2 border-t border-border pt-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-dim">{t("install.compare")}</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">{t("install.same")}</p>
        <ul className="space-y-2">
          {DIFFS.map((key) => (
            <li key={key} className="text-sm leading-relaxed text-foreground">
              {t(key)}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
