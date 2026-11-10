/**
 * A short chime for the end of a flexible block.
 * Browsers only allow audio after a user gesture, and a closed tab cannot play it.
 */

let ctx: AudioContext | null = null;
const played = new Set<string>();

export const SOUND_IDS = ["chime", "bell", "marimba", "bowl", "pulse"] as const;
export type SoundId = (typeof SOUND_IDS)[number] | "custom";

let soundId: SoundId = "chime";
let volume = 0.6;
let customBuffer: AudioBuffer | null = null;

export function configureAlarm(next: { id?: string; volume?: number; buffer?: AudioBuffer | null }) {
  if (next.id === "custom" || SOUND_IDS.includes(next.id as (typeof SOUND_IDS)[number])) soundId = next.id as SoundId;
  if (typeof next.volume === "number") volume = Math.min(1, Math.max(0, next.volume));
  if (next.buffer !== undefined) customBuffer = next.buffer;
}

export function currentSound(): SoundId {
  return soundId;
}

function audioCtor(): typeof AudioContext | null {
  if (typeof window === "undefined") return null;
  return window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext ?? null;
}

/** Call from a click/tap that starts a timer so later chimes are allowed. */
export function unlockAlarm(): boolean {
  const AC = audioCtor();
  if (!AC) return false;
  if (!ctx) ctx = new AC();
  try {
    const buffer = ctx.createBuffer(1, 1, 22050);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(ctx.destination);
    src.start(0);
    if (ctx.state === "suspended") void ctx.resume();
  } catch {
    return false;
  }
  return ctx.state === "running";
}

export function alarmCanPlay(): boolean {
  return !!ctx && ctx.state === "running";
}

function tone(freq: number, at: number, dur: number, type: OscillatorType, peak: number) {
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  osc.connect(gain);
  gain.connect(ctx.destination);
  const level = Math.max(0.0001, peak * volume);
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(level, at + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  osc.start(at);
  osc.stop(at + dur + 0.02);
}

function playPattern(id: SoundId) {
  if (!ctx) return;
  const t = ctx.currentTime;
  if (id === "bell") {
    tone(784, t, 0.7, "sine", 0.07);
    tone(1175, t, 0.4, "sine", 0.03);
    return;
  }
  if (id === "marimba") {
    tone(392, t, 0.18, "triangle", 0.08);
    tone(494, t + 0.16, 0.18, "triangle", 0.07);
    tone(587, t + 0.32, 0.28, "triangle", 0.06);
    return;
  }
  if (id === "bowl") {
    tone(220, t, 1.1, "sine", 0.06);
    tone(330, t + 0.05, 0.9, "sine", 0.03);
    return;
  }
  if (id === "pulse") {
    tone(440, t, 0.12, "sine", 0.05);
    tone(440, t + 0.2, 0.12, "sine", 0.05);
    tone(523, t + 0.4, 0.2, "sine", 0.04);
    return;
  }
  tone(660, t, 0.28, "sine", 0.06);
  tone(880, t + 0.16, 0.28, "sine", 0.05);
}

/** One reminder sound per key. Returns false when audio isn't available. */
export function playBlockChime(key: string, force = false): boolean {
  if (!force && played.has(key)) return false;
  if (!ctx || ctx.state !== "running") return false;
  try {
    if (soundId === "custom" && customBuffer) {
      const src = ctx.createBufferSource();
      const gain = ctx.createGain();
      src.buffer = customBuffer;
      gain.gain.value = volume;
      src.connect(gain);
      gain.connect(ctx.destination);
      src.start();
    } else {
      playPattern(soundId === "custom" ? "chime" : soundId);
    }
    played.add(key);
    return true;
  } catch {
    return false;
  }
}

const DB = "nowmode-sounds";
const STORE = "files";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export const MAX_SOUND_BYTES = 1_500_000;

export async function saveCustomSound(file: File): Promise<"ok" | "big" | "bad"> {
  if (file.size > MAX_SOUND_BYTES) return "big";
  if (file.type && !file.type.startsWith("audio/")) return "bad";
  if (!unlockAlarm() || !ctx) return "bad";
  try {
    const copy = await file.arrayBuffer();
    const buffer = await ctx.decodeAudioData(copy.slice(0));
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(file, "custom");
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    customBuffer = buffer;
    soundId = "custom";
    return "ok";
  } catch {
    return "bad";
  }
}

export async function loadCustomSound(): Promise<boolean> {
  if (typeof indexedDB === "undefined") return false;
  try {
    const db = await openDb();
    const file = await new Promise<Blob | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get("custom");
      req.onsuccess = () => resolve(req.result as Blob | undefined);
      req.onerror = () => reject(req.error);
    });
    if (!file || !ctx) return false;
    customBuffer = await ctx.decodeAudioData(await file.arrayBuffer());
    return true;
  } catch {
    return false;
  }
}

export async function clearCustomSound(): Promise<void> {
  customBuffer = null;
  if (typeof indexedDB === "undefined") return;
  const db = await openDb();
  await new Promise<void>((resolve) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete("custom");
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
}
