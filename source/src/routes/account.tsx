import { createFileRoute } from "@tanstack/react-router";
import { BellRing, Moon, LogOut, Palette, Timer } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Avatar } from "@/components/nowmode/Avatar";
import { greetingName } from "@/lib/nowmode/profile";
import { toast } from "sonner";

import { Loading } from "@/components/nowmode/Loading";
import { ScreenHeader } from "@/components/nowmode/ScreenHeader";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useLocale, useT } from "@/lib/i18n/context";
import { formatLocaleTime } from "@/lib/i18n/format";
import { LOCALES, type LocaleId } from "@/lib/i18n/locale";
import { clearCustomSound, configureAlarm, playBlockChime, saveCustomSound, SOUND_IDS, unlockAlarm } from "@/lib/nowmode/alarm";
import { PhotoDenied, forgetAlarmFile, openAppSettings, photoAccess, pickAlarmFile, storeAlarmFile, takeOrChoosePhoto } from "@/lib/nowmode/native-device";
import { syncNativeReminders } from "@/lib/nowmode/native-sync";
import { currentNotifyPermission, requestNotifyPermission } from "@/lib/nowmode/notify-permission";
import { PermitCard } from "@/components/nowmode/PermitCard";
import { useNowMode } from "@/lib/nowmode/store";
import {
  DEFAULT_NUDGES,
  DEFAULT_QUIET_END,
  DEFAULT_QUIET_START,
  normalizeLead,
  normalizePalette,
  normalizeTheme,
  quietRangeError,
  type PaletteId,
  type ThemeMode,
} from "@/lib/nowmode/settings";
import type { Nudges, Prefs } from "@/lib/nowmode/types";

export const Route = createFileRoute("/account")({
  head: () => ({
    meta: [{ title: "Account · Now Mode" }, { name: "description", content: "Language, reminders, quiet hours, and theme." }],
  }),
  component: Account,
});

async function compressDataUrl(raw: string): Promise<string | null> {
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("image"));
      image.src = raw;
    });
    const scale = Math.min(1, 320 / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.width * scale));
    canvas.height = Math.max(1, Math.round(img.height * scale));
    canvas.getContext("2d")?.drawImage(img, 0, 0, canvas.width, canvas.height);
    const small = canvas.toDataURL("image/jpeg", 0.7);
    return small.length > 350_000 ? canvas.toDataURL("image/jpeg", 0.45) : small;
  } catch {
    return null;
  }
}

async function compressImage(file: File): Promise<string | null> {
  try {
    const raw = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("image"));
      image.src = raw;
    });
    const scale = Math.min(1, 320 / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.width * scale));
    canvas.height = Math.max(1, Math.round(img.height * scale));
    canvas.getContext("2d")?.drawImage(img, 0, 0, canvas.width, canvas.height);
    const small = canvas.toDataURL("image/jpeg", 0.7);
    return small.length > 350_000 ? canvas.toDataURL("image/jpeg", 0.45) : small;
  } catch {
    return null;
  }
}

function ProfileCard() {
  const t = useT();
  const native = import.meta.env.VITE_NATIVE === "1";
  const { state, setPrefs } = useNowMode();
  const prefs = state.prefs;
  const [gate, setGate] = useState<null | "camera" | "photos" | "denied-camera" | "denied-photos">(null);
  const usePhoto = async (source: "camera" | "photos") => {
    try {
      const url = await takeOrChoosePhoto(source);
      if (!url) {
        setGate(null);
        return;
      }
      const small = await compressDataUrl(url);
      if (!small || small.length > 350_000) {
        toast(t("storage.full"), { description: t("profile.photoBig") });
        return;
      }
      setPrefs({ avatar: small });
      setGate(null);
    } catch (err) {
      setGate(err instanceof PhotoDenied ? (source === "camera" ? "denied-camera" : "denied-photos") : null);
    }
  };
  const beginPhoto = async (source: "camera" | "photos") => {
    const access = await photoAccess(source);
    if (access === "granted") {
      await usePhoto(source);
      return;
    }
    setGate(access === "denied" ? (source === "camera" ? "denied-camera" : "denied-photos") : source);
  };
  const name = greetingName(prefs);
  return (
    <section data-tour="account" className="space-y-3 rounded-[20px] border border-border2 bg-hero p-5">
      <div className="flex items-center gap-4">
        <Avatar prefs={prefs} size="size-14 text-xl" />
        <div className="min-w-0">
          <p className="truncate text-lg font-bold">{name || t("account.name")}</p>
          {!name && <p className="text-xs text-dim">{t("profile.missing")}</p>}
          <span className="mt-2 inline-block rounded-full border border-blue/40 bg-blue/10 px-2.5 py-0.5 text-[11px] font-semibold text-blue">{t("account.plan")}</span>
        </div>
      </div>
      <label className="block text-xs font-semibold">
        {t("profile.username")}
        <input
          value={prefs.username ?? ""}
          onChange={(e) => setPrefs({ username: e.target.value })}
          className="mt-1 h-11 w-full rounded-xl border border-border2 bg-card px-3 text-sm font-medium focus:border-blue focus:outline-none"
        />
      </label>
      <label className="block text-xs font-semibold">
        {t("profile.realName")}
        <input
          value={prefs.realName ?? ""}
          onChange={(e) => setPrefs({ realName: e.target.value })}
          className="mt-1 h-11 w-full rounded-xl border border-border2 bg-card px-3 text-sm font-medium focus:border-blue focus:outline-none"
        />
      </label>
      <fieldset>
        <legend className="text-xs font-semibold">{t("profile.greet")}</legend>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {(["realName", "username"] as const).map((choice) => (
            <button
              key={choice}
              type="button"
              aria-pressed={(prefs.greetAs ?? "realName") === choice}
              onClick={() => setPrefs({ greetAs: choice })}
              className={`rounded-xl border px-2 py-2 text-xs font-semibold ${(prefs.greetAs ?? "realName") === choice ? "border-blue/60 bg-blue/15 text-blue" : "border-border2 text-muted-foreground"}`}
            >
              {t(choice === "realName" ? "profile.greetReal" : "profile.greetUser")}
            </button>
          ))}
        </div>
      </fieldset>
      {gate === "camera" && <PermitCard title="permit.cameraTitle" body="permit.cameraWhy" onAllow={() => void usePhoto("camera")} onLater={() => setGate(null)} onSettings={() => void openAppSettings()} />}
      {gate === "photos" && <PermitCard title="permit.photosTitle" body="permit.photosWhy" onAllow={() => void usePhoto("photos")} onLater={() => setGate(null)} onSettings={() => void openAppSettings()} />}
      {(gate === "denied-camera" || gate === "denied-photos") && (
        <PermitCard
          title={gate === "denied-camera" ? "permit.cameraTitle" : "permit.photosTitle"}
          body={gate === "denied-camera" ? "permit.cameraDenied" : "permit.photosDenied"}
          denied
          onAllow={() => {}}
          onLater={() => setGate(null)}
          onSettings={() => void openAppSettings()}
        />
      )}
      <div className="flex flex-wrap gap-2">
        {native && (
          <>
            <Button type="button" variant="secondary" className="h-10 rounded-xl" onClick={() => void beginPhoto("camera")}>{t("permit.cameraTitle")}</Button>
            <Button type="button" variant="secondary" className="h-10 rounded-xl" onClick={() => void beginPhoto("photos")}>{t("permit.photosTitle")}</Button>
          </>
        )}
        <label className={`inline-flex h-10 cursor-pointer items-center rounded-xl border border-border2 bg-card px-3 text-xs font-semibold ${native ? "hidden" : ""}`}>
          {t("profile.photoBtn")}
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              const url = await compressImage(file);
              if (!url || url.length > 350_000) {
                toast(t("storage.full"), { description: t("profile.photoBig") });
                return;
              }
              setPrefs({ avatar: url });
            }}
          />
        </label>
        {prefs.avatar && (
          <Button type="button" variant="secondary" className="h-10 rounded-xl" onClick={() => setPrefs({ avatar: undefined })}>
            {t("profile.photoRemove")}
          </Button>
        )}
      </div>
    </section>
  );
}

function SoundSettings() {
  const t = useT();
  const { state, setPrefs } = useNowMode();
  const native = import.meta.env.VITE_NATIVE === "1";
  const [note, setNote] = useState<string | null>(null);
  const [perm, setPerm] = useState<NotificationPermission | "unsupported">("unsupported");
  const [gate, setGate] = useState<null | "files" | "notify" | "denied-notify">(null);
  const importSound = async () => {
    unlockAlarm();
    let picked: Awaited<ReturnType<typeof pickAlarmFile>>;
    try {
      picked = await pickAlarmFile();
    } catch {
      setNote(t("sound.bad"));
      return;
    }
    if (!picked) {
      setGate(null);
      return;
    }
    const type = picked.type.startsWith("audio/") ? picked.type : "audio/mpeg";
    const audio = picked.bytes.buffer.slice(picked.bytes.byteOffset, picked.bytes.byteOffset + picked.bytes.byteLength) as ArrayBuffer;
    const file = new File([audio], picked.name, { type });
    const result = await saveCustomSound(file);
    if (result !== "ok") {
      setNote(t(result === "big" ? "sound.big" : "sound.bad"));
      return;
    }
    try {
      await storeAlarmFile(picked.bytes, picked.ext);
    } catch {
      setNote(t("sound.bad"));
      return;
    }
    setPrefs({ alarmSound: "custom" });
    setNote(t("sound.imported"));
    setGate(null);
  };
  useEffect(() => {
    void currentNotifyPermission().then(setPerm);
  }, []);
  const sound = state.prefs.alarmSound ?? "chime";
  const volume = state.prefs.alarmVolume ?? 60;
  const options = [...SOUND_IDS, ...(sound === "custom" ? (["custom"] as const) : [])];

  return (
    <section className="space-y-3 rounded-2xl border border-border bg-card px-4 py-4">
      <div>
        <h2 className="text-sm font-semibold">{t("sound.title")}</h2>
        <p className="text-xs text-dim">{t("sound.hint")}</p>
      </div>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t("sound.title")}>
        {options.map((id) => (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={sound === id}
            onClick={() => setPrefs({ alarmSound: id })}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${sound === id ? "border-blue/60 bg-blue/15 text-blue" : "border-border2 text-muted-foreground"}`}
          >
            {t(id === "chime" ? "sound.chime" : id === "bell" ? "sound.bell" : id === "marimba" ? "sound.marimba" : id === "bowl" ? "sound.bowl" : id === "pulse" ? "sound.pulse" : "sound.custom")}
          </button>
        ))}
      </div>
      <label className="block text-xs font-semibold">
        {t("sound.volume")} {volume}
        <input
          type="range"
          min={0}
          max={100}
          value={volume}
          aria-label={t("sound.volume")}
          onChange={(e) => setPrefs({ alarmVolume: Number(e.target.value) })}
          className="mt-1 w-full"
        />
      </label>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="secondary"
          className="h-10 rounded-xl"
          onClick={() => {
            unlockAlarm();
            configureAlarm({ id: sound, volume: volume / 100 });
            playBlockChime(`preview-${Date.now()}`, true);
          }}
        >
          {t("sound.preview")}
        </Button>
        {native ? (
          <Button type="button" variant="secondary" className="h-10 rounded-xl" onClick={() => setGate("files")}>
            {t("sound.import")}
          </Button>
        ) : (
        <label className="inline-flex h-10 cursor-pointer items-center rounded-xl border border-border2 bg-card px-3 text-xs font-semibold">
          {t("sound.import")}
          <input
            type="file"
            accept="audio/*"
            className="sr-only"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              const result = await saveCustomSound(file);
              if (result !== "ok") {
                setNote(t(result === "big" ? "sound.big" : "sound.bad"));
                return;
              }
              setPrefs({ alarmSound: "custom" });
              setNote(null);
            }}
          />
        </label>
        )}
        <Button
          type="button"
          variant="secondary"
          className="h-10 rounded-xl"
          onClick={() => {
            void clearCustomSound();
            forgetAlarmFile();
            setPrefs({ alarmSound: "chime", alarmVolume: 60 });
            setNote(null);
          }}
        >
          {t("sound.reset")}
        </Button>
      </div>
      {gate === "files" && (
        <PermitCard title="permit.filesTitle" body="permit.filesWhy" onAllow={() => void importSound()} onLater={() => setGate(null)} onSettings={() => void openAppSettings()} />
      )}
      {gate === "notify" && (
        <PermitCard
          title="permit.notifyTitle"
          body="permit.notifyWhy"
          onAllow={async () => {
            const next = await requestNotifyPermission();
            setPerm(next);
            setGate(next === "granted" ? null : "denied-notify");
            if (next === "granted") void syncNativeReminders(state);
          }}
          onLater={() => setGate(null)}
          onSettings={() => void openAppSettings()}
        />
      )}
      {gate === "denied-notify" && (
        <PermitCard title="permit.notifyTitle" body="permit.notifyDenied" denied onAllow={() => {}} onLater={() => setGate(null)} onSettings={() => void openAppSettings()} />
      )}
      {note && <p role="alert" className="text-xs text-coral">{note}</p>}
      <div className="space-y-2 border-t border-border pt-3">
        <button
          type="button"
          className="h-10 rounded-xl border border-border2 px-3 text-xs font-semibold"
          onClick={async () => {
            if (native && perm !== "granted") {
              setGate("notify");
              return;
            }
            const next = await requestNotifyPermission();
            setPerm(next);
            if (next === "granted" && native) void syncNativeReminders(state);
          }}
        >
          {perm === "granted" ? t("sound.allowed") : t("sound.allow")}
        </button>
        <p className="text-[11px] leading-relaxed text-dim">{import.meta.env.VITE_NATIVE === "1" ? t("sound.limitNative") : t("sound.limit")}</p>
      </div>
    </section>
  );
}

function Account() {
  const t = useT();
  const locale = useLocale();
  const { ready, state, setPrefs } = useNowMode();
  const [editing, setEditing] = useState<null | "nudges" | "focus" | "quiet" | "theme">(null);
  if (!ready) return <Loading />;
  const p = state.prefs;
  const quietStart = p.quietStart ?? DEFAULT_QUIET_START;
  const quietEnd = p.quietEnd ?? DEFAULT_QUIET_END;

  return (
    <div className="pb-8">
      <ScreenHeader back title={t("account.title")} />
      <div className="space-y-5 px-5">
        <ProfileCard />

        <section>
          <h2 className="px-1 pb-2 text-[11px] font-bold uppercase tracking-wider text-dim">{t("account.language")}</h2>
          <label className="block rounded-2xl border border-border bg-card px-4 py-3">
            <span className="block text-sm font-semibold">{t("account.language")}</span>
            <span className="block text-xs text-dim">{t("account.languageHint")}</span>
            <select
              value={locale}
              onChange={(e) => setPrefs({ locale: e.target.value as LocaleId })}
              className="mt-2 h-11 w-full rounded-xl border border-border2 bg-background px-3 text-sm focus:border-blue focus:outline-none"
            >
              {LOCALES.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
        </section>

        <SoundSettings />

        <section data-tour="settings">
          <h2 className="px-1 pb-2 text-[11px] font-bold uppercase tracking-wider text-dim">{t("account.section")}</h2>
          <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
            <SettingRow
              icon={<BellRing className="size-4" />}
              title={t("account.nudges")}
              hint={t("account.nudgesHint")}
              checked={p.layeredNudges}
              onChecked={(v) => setPrefs({ layeredNudges: v })}
              label={t("account.nudges")}
              editLabel={t("account.edit")}
              onEdit={() => setEditing("nudges")}
            />
            <SettingRow
              icon={<Timer className="size-4" />}
              title={t("account.focus")}
              hint={t("account.focusHint")}
              checked={p.focusReminders}
              onChecked={(v) => setPrefs({ focusReminders: v })}
              label={t("account.focus")}
              editLabel={t("account.edit")}
              onEdit={() => setEditing("focus")}
            />
            <SettingRow
              icon={<Moon className="size-4" />}
              title={t("account.quiet")}
              hint={t("account.quietHint", { start: formatLocaleTime(quietStart, locale), end: formatLocaleTime(quietEnd, locale) })}
              checked={p.quietHours}
              onChecked={(v) => setPrefs({ quietHours: v })}
              label={t("account.quiet")}
              editLabel={t("account.edit")}
              onEdit={() => setEditing("quiet")}
            />
            <div className="flex items-center gap-3 px-4 py-3.5">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-card2 text-muted-foreground">
                <Palette className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">{t("account.theme")}</span>
                <span className="block text-xs text-dim">{t("account.themeHint")}</span>
              </span>
              <Button type="button" variant="secondary" size="sm" className="h-9 rounded-xl" onClick={() => setEditing("theme")}>
                {t("account.edit")}
              </Button>
            </div>
          </div>
        </section>

        <button
          type="button"
          onClick={() => toast(t("account.soon"), { description: t("account.soonBody") })}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-border bg-card py-3.5 text-sm font-semibold text-muted-foreground hover:text-foreground"
        >
          <LogOut className="size-4" /> {t("account.signOut")}
        </button>
        <p className="text-center text-xs text-dim">{t("account.device")}</p>
      </div>
      {editing && <Editor kind={editing} prefs={p} onClose={() => setEditing(null)} />}
    </div>
  );
}

function SettingRow({
  icon,
  title,
  hint,
  checked,
  onChecked,
  label,
  editLabel,
  onEdit,
}: {
  icon: ReactNode;
  title: string;
  hint: string;
  checked: boolean;
  onChecked: (v: boolean) => void;
  label: string;
  editLabel: string;
  onEdit: () => void;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3.5">
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-card2 text-muted-foreground">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{title}</span>
        <span className="block text-xs text-dim">{hint}</span>
      </span>
      <Button type="button" variant="secondary" size="sm" className="h-9 rounded-xl" onClick={onEdit}>
        {editLabel}
      </Button>
      <Switch checked={checked} onCheckedChange={onChecked} aria-label={label} />
    </div>
  );
}

function Editor({ kind, prefs, onClose }: { kind: "nudges" | "focus" | "quiet" | "theme"; prefs: Prefs; onClose: () => void }) {
  const t = useT();
  const { setPrefs } = useNowMode();
  const snapshot = {
    themeMode: normalizeTheme(prefs.themeMode),
    palette: normalizePalette(prefs.palette),
  };

  return (
    <div className="fixed inset-0 z-40" role="dialog" aria-modal="true">
      <button
        type="button"
        className="absolute inset-0 bg-ink/70"
        aria-label={t("common.cancel")}
        onClick={() => {
          if (kind === "theme") setPrefs(snapshot);
          onClose();
        }}
      />
      <div className="absolute inset-x-0 bottom-0 max-h-[92%] overflow-y-auto rounded-t-3xl border-x border-t border-border2 bg-bg2 px-5 pb-6 pt-4 shadow-shell">
        {kind === "nudges" && <NudgeEditor prefs={prefs} onClose={onClose} />}
        {kind === "focus" && <FocusEditor prefs={prefs} onClose={onClose} />}
        {kind === "quiet" && <QuietEditor prefs={prefs} onClose={onClose} />}
        {kind === "theme" && <ThemeEditor prefs={prefs} onClose={onClose} snapshot={snapshot} />}
      </div>
    </div>
  );
}

function NudgeEditor({ prefs, onClose }: { prefs: Prefs; onClose: () => void }) {
  const t = useT();
  const { setPrefs } = useNowMode();
  const [value, setValue] = useState<Nudges>(prefs.nudgeDefaults ?? DEFAULT_NUDGES);
  const rows = [
    ["day", "nudge.layer.day"],
    ["hour", "nudge.layer.hour"],
    ["ten", "nudge.layer.ten"],
    ["now", "nudge.layer.now"],
  ] as const;
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        setPrefs({ nudgeDefaults: value });
        onClose();
      }}
    >
      <h2 className="text-lg font-bold">{t("account.nudgeTitle")}</h2>
      <p className="text-sm leading-relaxed text-muted-foreground">{t("account.nudgeBody")}</p>
      {rows.map(([key, label]) => (
        <label key={key} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-3 py-3">
          <span className="text-sm font-semibold">{t(label)}</span>
          <Switch checked={value[key]} onCheckedChange={(on) => setValue((v) => ({ ...v, [key]: on }))} aria-label={t(label)} />
        </label>
      ))}
      <SaveRow onClose={onClose} />
    </form>
  );
}

function FocusEditor({ prefs, onClose }: { prefs: Prefs; onClose: () => void }) {
  const t = useT();
  const { setPrefs } = useNowMode();
  const [lead, setLead] = useState(String(normalizeLead(prefs.focusLeadMin)));
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!/^\d+$/.test(lead.trim())) {
          setError(t("focus.badFormat"));
          return;
        }
        const n = Number(lead);
        if (n < 1 || n > 180) {
          setError(t("focus.badRange"));
          return;
        }
        setPrefs({ focusLeadMin: n });
        onClose();
      }}
    >
      <h2 className="text-lg font-bold">{t("account.focusTitle")}</h2>
      <p className="text-sm leading-relaxed text-muted-foreground">{t("account.focusBody")}</p>
      <label className="block text-xs font-semibold">
        {t("account.leadLabel")}
        <input
          inputMode="numeric"
          value={lead}
          onChange={(e) => {
            setLead(e.target.value);
            setError(null);
          }}
          className="mt-1 h-11 w-full rounded-xl border border-border2 bg-card px-3 text-sm focus:border-blue focus:outline-none"
        />
      </label>
      {error && <p role="alert" className="text-xs text-coral">{error}</p>}
      <SaveRow onClose={onClose} />
    </form>
  );
}

function QuietEditor({ prefs, onClose }: { prefs: Prefs; onClose: () => void }) {
  const t = useT();
  const { setPrefs } = useNowMode();
  const [start, setStart] = useState(prefs.quietStart ?? DEFAULT_QUIET_START);
  const [end, setEnd] = useState(prefs.quietEnd ?? DEFAULT_QUIET_END);
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        const problem = quietRangeError(start, end);
        if (problem === "equal") {
          setError(t("account.equal"));
          return;
        }
        if (problem) {
          setError(t("validate.time"));
          return;
        }
        setPrefs({ quietStart: start, quietEnd: end });
        onClose();
      }}
    >
      <h2 className="text-lg font-bold">{t("account.quietTitle")}</h2>
      <p className="text-sm leading-relaxed text-muted-foreground">{t("account.quietBody")}</p>
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-xs font-semibold">
          {t("account.from")}
          <input type="time" value={start} onChange={(e) => { setStart(e.target.value); setError(null); }} className="mt-1 h-11 w-full rounded-xl border border-border2 bg-card px-3 text-sm" />
        </label>
        <label className="block text-xs font-semibold">
          {t("account.to")}
          <input type="time" value={end} onChange={(e) => { setEnd(e.target.value); setError(null); }} className="mt-1 h-11 w-full rounded-xl border border-border2 bg-card px-3 text-sm" />
        </label>
      </div>
      {error && <p role="alert" className="text-xs text-coral">{error}</p>}
      <SaveRow onClose={onClose} />
    </form>
  );
}

function ThemeEditor({
  prefs,
  onClose,
  snapshot,
}: {
  prefs: Prefs;
  onClose: () => void;
  snapshot: { themeMode: ThemeMode; palette: PaletteId };
}) {
  const t = useT();
  const { setPrefs } = useNowMode();
  const mode = normalizeTheme(prefs.themeMode);
  const palette = normalizePalette(prefs.palette);
  const palettes: { id: PaletteId; label: string; hint: string }[] = [
    { id: "ocean", label: t("account.ocean"), hint: t("account.oceanHint") },
    { id: "lavender", label: t("account.lavender"), hint: t("account.lavenderHint") },
    { id: "forest", label: t("account.forest"), hint: t("account.forestHint") },
  ];
  return (
    <div className="space-y-3">
      <h2 className="text-lg font-bold">{t("account.themeTitle")}</h2>
      <p className="text-xs font-semibold">{t("account.mode")}</p>
      <div className="grid grid-cols-2 gap-2">
        {(["light", "dark"] as const).map((item) => (
          <button
            key={item}
            type="button"
            aria-pressed={mode === item}
            onClick={() => setPrefs({ themeMode: item })}
            className={`h-11 rounded-xl border text-sm font-semibold ${mode === item ? "border-blue bg-blue/15 text-blue" : "border-border2 bg-card"}`}
          >
            {item === "light" ? t("account.light") : t("account.dark")}
          </button>
        ))}
      </div>
      <p className="text-xs font-semibold">{t("account.palette")}</p>
      <div className="space-y-2">
        {palettes.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={palette === item.id}
            onClick={() => setPrefs({ palette: item.id })}
            className={`flex w-full items-center justify-between rounded-xl border px-3 py-3 text-left ${palette === item.id ? "border-blue bg-blue/10" : "border-border2 bg-card"}`}
          >
            <span className="text-sm font-semibold">{item.label}</span>
            <span className="text-xs text-dim">{item.hint}</span>
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3 pt-1">
        <Button
          type="button"
          variant="secondary"
          className="h-12 rounded-xl"
          onClick={() => {
            setPrefs(snapshot);
            onClose();
          }}
        >
          {t("common.cancel")}
        </Button>
        <Button type="button" className="h-12 rounded-xl" onClick={onClose}>
          {t("common.save")}
        </Button>
      </div>
    </div>
  );
}

function SaveRow({ onClose }: { onClose: () => void }) {
  const t = useT();
  return (
    <div className="grid grid-cols-2 gap-3 pt-1">
      <Button type="button" variant="secondary" className="h-12 rounded-xl" onClick={onClose}>
        {t("common.cancel")}
      </Button>
      <Button type="submit" className="h-12 rounded-xl">
        {t("common.save")}
      </Button>
    </div>
  );
}
