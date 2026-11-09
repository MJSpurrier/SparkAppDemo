/**
 * A short chime for the end of a flexible block.
 * Browsers only allow audio after a user gesture, and a closed tab cannot play it.
 */

let ctx: AudioContext | null = null;
const played = new Set<string>();

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

/** One brief two-note chime per key. Returns false when audio isn't available. */
export function playBlockChime(key: string, force = false): boolean {
  if (!force && played.has(key)) return false;
  if (!ctx || ctx.state !== "running") return false;
  try {
    const t = ctx.currentTime;
    const beep = (freq: number, at: number) => {
      const osc = ctx!.createOscillator();
      const gain = ctx!.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      osc.connect(gain);
      gain.connect(ctx!.destination);
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(0.06, at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.28);
      osc.start(at);
      osc.stop(at + 0.3);
    };
    beep(660, t);
    beep(880, t + 0.16);
    played.add(key);
    return true;
  } catch {
    return false;
  }
}
