import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";

import {
  NUDGE_TIERS,
  eventDate,
  nudgeCopy,
  splitIntoSteps,
  toDateKey,
  toggleStep as toggleStepPure,
  uid,
  type NudgeKey,
} from "./logic";
import { createSeed } from "./seed";
import type { AppState, BoardCard, Energy, FocusState, NowEvent, Prefs } from "./types";

export const STORAGE_KEY = "nowmode-v1";

export const FOCUS_PRESETS = [
  { id: "meditate", label: "Meditate", minutes: 5 },
  { id: "study", label: "Study", minutes: 25 },
  { id: "clean", label: "Clean", minutes: 15 },
  { id: "custom", label: "Custom", minutes: 10 },
] as const;

function load(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AppState>;
      if (parsed && parsed.version === 1) {
        const seed = createSeed();
        return {
          ...seed,
          ...parsed,
          prefs: { ...seed.prefs, ...parsed.prefs },
          focus: { ...seed.focus, ...parsed.focus },
        } as AppState;
      }
    }
  } catch {
    /* fall through to seed */
  }
  return createSeed();
}

export function notify(message: string, opts?: { title?: string }) {
  toast(opts?.title ?? "Now Mode", { description: message });
  try {
    if (
      typeof Notification !== "undefined" &&
      Notification.permission === "granted" &&
      typeof document !== "undefined" &&
      document.hidden
    ) {
      new Notification(opts?.title ?? "Now Mode", { body: message });
    }
  } catch {
    /* notifications are optional */
  }
}

function extendFocusState(f: FocusState, min: number): FocusState {
  const add = min * 60;
  const remaining = (f.finished ? 0 : f.remainingSec) + add;
  return {
    ...f,
    totalSec: f.finished ? add : f.totalSec + add,
    remainingSec: remaining,
    running: true,
    endsAt: Date.now() + remaining * 1000,
    finished: false,
    twoMinNotified: remaining <= 120,
  };
}

function inQuietHours(d: Date) {
  const h = d.getHours();
  return h >= 22 || h < 7;
}

interface StartFocusOpts {
  minutes?: number;
  eventId?: string | null;
  label?: string;
  presetId?: string;
}

interface Store {
  ready: boolean;
  state: AppState;
  setEnergy: (e: Energy) => void;
  addEvent: (e: Omit<NowEvent, "id" | "done" | "nudges"> & Partial<Pick<NowEvent, "nudges">>) => NowEvent;
  toggleDone: (id: string) => void;
  splitTask: (id: string) => void;
  toggleStep: (eventId: string, stepId: string) => void;
  toggleNudge: (eventId: string, key: NudgeKey) => void;
  previewNudges: (eventId: string) => void;
  setPrefs: (p: Partial<Prefs>) => void;
  addCard: (c: Omit<BoardCard, "id" | "x" | "y"> & Partial<Pick<BoardCard, "x" | "y">>) => void;
  moveCard: (id: string, x: number, y: number) => void;
  removeCard: (id: string) => void;
  addLink: (from: string, to: string) => boolean;
  removeLink: (id: string) => void;
  selectPreset: (id: string) => void;
  setCustomMin: (m: number) => void;
  startFocus: (opts?: StartFocusOpts) => void;
  pauseFocus: () => void;
  resumeFocus: () => void;
  resetFocus: () => void;
  extendFocus: (min: number) => void;
  setBodyDouble: (on: boolean) => void;
  checkIn: (choice: "good" | "more") => void;
  resetAll: () => void;
}

const Ctx = createContext<Store | null>(null);

export function NowModeProvider({ children }: { children: ReactNode }) {
  // Seed is replaced from localStorage after mount, so SSR and first client render match.
  const [state, setState] = useState<AppState>(() => createSeed(new Date(2026, 0, 1)));
  const [ready, setReady] = useState(false);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    setState(load());
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      toast("Storage is full", { description: "Try removing a photo card or two." });
    }
  }, [state, ready]);

  const update = useCallback((fn: (s: AppState) => AppState) => setState((s) => fn(s)), []);
  const updateFocus = useCallback(
    (fn: (f: FocusState) => FocusState) => setState((s) => ({ ...s, focus: fn(s.focus) })),
    [],
  );
  const updateEvent = useCallback(
    (id: string, fn: (e: NowEvent) => NowEvent) =>
      setState((s) => ({ ...s, events: s.events.map((e) => (e.id === id ? fn(e) : e)) })),
    [],
  );

  const addWin = useCallback((label: string) => {
    setState((s) => ({ ...s, wins: [...s.wins, { id: uid(), date: toDateKey(new Date()), label }] }));
  }, []);

  // Focus timer tick
  useEffect(() => {
    if (!ready || !state.focus.running) return;
    const id = window.setInterval(() => {
      const f = stateRef.current.focus;
      if (!f.running || !f.endsAt) return;
      const remaining = Math.max(0, Math.ceil((f.endsAt - Date.now()) / 1000));
      let next: FocusState = { ...f, remainingSec: remaining };
      if (!f.twoMinNotified && remaining <= 120 && remaining > 0 && f.totalSec > 150) {
        next.twoMinNotified = true;
        if (stateRef.current.prefs.focusReminders) {
          notify("Two minutes left. Start landing the plane — gently.", { title: "Soft transition" });
        }
      }
      if (remaining === 0) {
        next = { ...next, running: false, endsAt: null, finished: true };
        notify("Session complete. Check in when you're ready — no score.", { title: "You amplified" });
      }
      setState((s) => ({ ...s, focus: next }));
    }, 500);
    return () => window.clearInterval(id);
  }, [ready, state.focus.running]);

  // Layered nudges
  useEffect(() => {
    if (!ready) return;
    const check = () => {
      const s = stateRef.current;
      if (!s.prefs.layeredNudges) return;
      const now = new Date();
      const fired: string[] = [];
      for (const ev of s.events) {
        if (ev.done) continue;
        const at = eventDate(ev).getTime();
        for (const tier of NUDGE_TIERS) {
          if (!ev.nudges[tier.key]) continue;
          const key = `${ev.id}:${tier.key}`;
          if (s.firedNudges.includes(key)) continue;
          const target = at - tier.offsetMin * 60_000;
          const diff = now.getTime() - target;
          if (diff >= 0 && diff < 5 * 60_000) {
            fired.push(key);
            if (!(s.prefs.quietHours && inQuietHours(now))) notify(nudgeCopy(tier.key, ev));
          }
        }
      }
      if (fired.length) {
        setState((p) => ({ ...p, firedNudges: [...p.firedNudges, ...fired].slice(-300) }));
      }
    };
    check();
    const id = window.setInterval(check, 30_000);
    return () => window.clearInterval(id);
  }, [ready]);

  const store = useMemo<Store>(
    () => ({
      ready,
      state,
      setEnergy: (energy) => update((s) => ({ ...s, energy })),
      addEvent: (e) => {
        const full: NowEvent = {
          id: uid(),
          done: false,
          nudges: e.nudges ?? { day: false, hour: true, ten: true, now: true },
          ...e,
        };
        update((s) => ({ ...s, events: [...s.events, full] }));
        return full;
      },
      toggleDone: (id) => {
        const ev = stateRef.current.events.find((e) => e.id === id);
        if (ev && !ev.done) addWin(ev.title);
        updateEvent(id, (e) => {
          const next: NowEvent = { ...e, done: !e.done };
          if (e.steps) next.steps = e.steps.map((st) => ({ ...st, done: !e.done ? true : st.done }));
          return next;
        });
      },
      splitTask: (id) =>
        updateEvent(id, (e) => (e.steps?.length ? e : { ...e, steps: splitIntoSteps(e.title) })),
      toggleStep: (eventId, stepId) => {
        const ev = stateRef.current.events.find((e) => e.id === eventId);
        if (!ev) return;
        const next = toggleStepPure(ev, stepId);
        if (next.done && !ev.done) {
          addWin(ev.title);
          toast("All steps done", { description: `${ev.title} — that's a real win.` });
        }
        updateEvent(eventId, () => next);
      },
      toggleNudge: (eventId, key) =>
        updateEvent(eventId, (e) => ({ ...e, nudges: { ...e.nudges, [key]: !e.nudges[key] } })),
      previewNudges: (eventId) => {
        const ev = stateRef.current.events.find((e) => e.id === eventId);
        if (!ev) return;
        const tiers = NUDGE_TIERS.filter((t) => ev.nudges[t.key]);
        if (!tiers.length) {
          toast("No nudges on", { description: "Turn on a layer to preview it." });
          return;
        }
        tiers.forEach((t, i) => window.setTimeout(() => notify(nudgeCopy(t.key, ev)), i * 1400));
      },
      setPrefs: (p) => update((s) => ({ ...s, prefs: { ...s.prefs, ...p } })),
      addCard: (c) =>
        update((s) => {
          const n = s.cards.length;
          return {
            ...s,
            cards: [
              ...s.cards,
              { id: uid(), x: c.x ?? 24 + ((n * 37) % 180), y: c.y ?? 30 + ((n * 61) % 360), ...c },
            ],
          };
        }),
      moveCard: (id, x, y) =>
        update((s) => ({ ...s, cards: s.cards.map((c) => (c.id === id ? { ...c, x, y } : c)) })),
      removeCard: (id) =>
        update((s) => ({
          ...s,
          cards: s.cards.filter((c) => c.id !== id),
          links: s.links.filter((l) => l.from !== id && l.to !== id),
        })),
      addLink: (from, to) => {
        if (from === to) return false;
        const exists = stateRef.current.links.some(
          (l) => (l.from === from && l.to === to) || (l.from === to && l.to === from),
        );
        if (exists) return false;
        update((s) => ({ ...s, links: [...s.links, { id: uid(), from, to }] }));
        return true;
      },
      removeLink: (id) => update((s) => ({ ...s, links: s.links.filter((l) => l.id !== id) })),
      selectPreset: (id) =>
        updateFocus((f) => {
          if (f.running) return f;
          const p = FOCUS_PRESETS.find((x) => x.id === id);
          const minutes = id === "custom" ? f.customMin : (p?.minutes ?? 25);
          return {
            ...f,
            presetId: id,
            label: p?.label ?? f.label,
            eventId: null,
            totalSec: minutes * 60,
            remainingSec: minutes * 60,
            finished: false,
            twoMinNotified: false,
            endsAt: null,
          };
        }),
      setCustomMin: (m) =>
        updateFocus((f) => {
          const customMin = Math.min(120, Math.max(1, m));
          if (f.running || f.presetId !== "custom") return { ...f, customMin };
          return { ...f, customMin, totalSec: customMin * 60, remainingSec: customMin * 60 };
        }),
      startFocus: (opts) =>
        updateFocus((f) => {
          const minutes = opts?.minutes;
          const totalSec = minutes ? minutes * 60 : f.totalSec;
          const remaining = minutes ? minutes * 60 : f.finished || f.remainingSec <= 0 ? f.totalSec : f.remainingSec;
          return {
            ...f,
            presetId: opts?.presetId ?? f.presetId,
            label: opts?.label ?? f.label,
            eventId: opts?.eventId !== undefined ? opts.eventId : f.eventId,
            totalSec,
            remainingSec: remaining,
            running: true,
            endsAt: Date.now() + remaining * 1000,
            finished: false,
            twoMinNotified: minutes ? false : f.twoMinNotified,
          };
        }),
      pauseFocus: () =>
        updateFocus((f) => ({
          ...f,
          running: false,
          endsAt: null,
          remainingSec: f.endsAt ? Math.max(0, Math.ceil((f.endsAt - Date.now()) / 1000)) : f.remainingSec,
        })),
      resumeFocus: () =>
        updateFocus((f) => ({ ...f, running: true, endsAt: Date.now() + f.remainingSec * 1000 })),
      resetFocus: () =>
        updateFocus((f) => ({
          ...f,
          running: false,
          endsAt: null,
          remainingSec: f.totalSec,
          finished: false,
          twoMinNotified: false,
        })),
      extendFocus: (min) => updateFocus((f) => extendFocusState(f, min)),
      setBodyDouble: (on) => updateFocus((f) => ({ ...f, bodyDouble: on })),
      checkIn: (choice) => {
        const f = stateRef.current.focus;
        if (choice === "more") {
          updateFocus((x) => extendFocusState(x, 5));
          return;
        }
        addWin(f.label || "Focus session");
        if (f.eventId) {
          updateEvent(f.eventId, (e) => ({ ...e, done: true }));
        }
        updateFocus((x) => ({ ...x, finished: false, remainingSec: x.totalSec, twoMinNotified: false }));
      },
      resetAll: () => {
        setState(createSeed());
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ready, state, update, updateFocus, updateEvent, addWin],
  );

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export function useNowMode(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error("useNowMode must be used inside NowModeProvider");
  return s;
}

/** Live wall clock, updated every `ms`. Only meaningful after mount. */
export function useNow(ms = 15_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    setNow(new Date());
    const id = window.setInterval(() => setNow(new Date()), ms);
    return () => window.clearInterval(id);
  }, [ms]);
  return now;
}