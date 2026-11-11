import type { LocaleId } from "@/lib/i18n/locale";

export const AUDIO_MIME = [
  "audio/mpeg",
  "audio/mp3",
  "audio/mp4",
  "audio/x-m4a",
  "audio/m4a",
  "audio/wav",
  "audio/x-wav",
  "audio/wave",
  "audio/ogg",
  "audio/webm",
  "audio/*",
] as const;

const EXT: Record<string, string> = {
  mp3: "mp3",
  mpeg: "mp3",
  m4a: "m4a",
  mp4: "m4a",
  wav: "wav",
  wave: "wav",
  ogg: "ogg",
  oga: "ogg",
  opus: "ogg",
  webm: "webm",
};

/** Android does not ship an es-419 recognizer, so Latin American Spanish uses es-MX. */
export function speechLanguage(locale: LocaleId): string {
  if (locale === "es-ES") return "es-ES";
  if (locale === "es-419") return "es-MX";
  return "en-US";
}

export function speechEngine(native: boolean, webAvailable: boolean): "native" | "web" | "none" {
  if (native) return "native";
  return webAvailable ? "web" : "none";
}

export function audioExtension(name: string, mime?: string): string | null {
  const fromName = /\.([a-z0-9]+)$/i.exec(name.trim())?.[1]?.toLowerCase();
  if (fromName && EXT[fromName]) return EXT[fromName];
  const fromMime = (mime ?? "").toLowerCase().split("/")[1]?.split(";")[0]?.replace(/^x-/, "");
  if (fromMime && EXT[fromMime]) return EXT[fromMime];
  return null;
}

const SOUND_KEY = "nowmode-custom-sound";

export interface CustomSoundMeta {
  file: string;
  rev: number;
}

export function readCustomSound(): CustomSoundMeta | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(SOUND_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CustomSoundMeta>;
    if (!parsed.file || typeof parsed.rev !== "number") return null;
    return { file: parsed.file, rev: parsed.rev };
  } catch {
    return null;
  }
}

export function writeCustomSound(meta: CustomSoundMeta) {
  localStorage.setItem(SOUND_KEY, JSON.stringify(meta));
}

export function clearCustomSoundMeta() {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(SOUND_KEY);
}
