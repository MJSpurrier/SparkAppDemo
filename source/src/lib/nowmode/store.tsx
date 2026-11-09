import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { explainScheduleError, translate } from "@/lib/i18n/context";
import { formatLocaleTime } from "@/lib/i18n/format";
import { resolvedLocale } from "@/lib/i18n/context";
import { playBlockChime } from "./alarm";
import {
  NUDGE_TIERS,
  eventDate,
  splitIntoSteps,
  toDateKey,
  toggleStep as toggleStepPure,
  uid,
  type NudgeKey,
} from "./logic";
import {
  applyReschedule,
  clearFiredFor,
  defaultFocus,
  eventStartMs,
  eventEndMs,
  fixedConflict,
  migrateAppState,
  planBlockTimer,
  planExtension,
  scheduleOf,
  slotChanged,
  normalizeTime,
  validateSlot,
  type SlotInput,
} from "./schedule";
import { createSeed } from "./seed";
import {
  DEFAULT_NUDGES,
  DEFAULT_QUIET_END,
  DEFAULT_QUIET_START,
  isQuietAt,
  normalizeLead,
  nudgeTierAllowed,
  parseCustomDuration,
  shouldLeadWarn,
} from "./settings";
import type { AppState, BoardCard, Energy, FocusState, NowEvent, Prefs, ScheduleType } from "./types";

export const STORAGE_KEY = "nowmode-v1";

export const FOCUS_PRESETS = [
  { id: "meditate", label: "Meditate", minutes: 5 },
  { id: "study", label: "Study", minutes: 25 },
  { id: "clean", label: "Clean", minutes: 15 },
  { id: "custom", label: "Custom", minutes: 10 },
] as const;

export type ExtendResult =
  | { ok: true }
  | { ok: false; message: string; reason?: "conflict"; minutes?: number };

export type ScheduleInput = SlotInput & { schedule: ScheduleType };

function load(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const migrated = migrateAppState(JSON.parse(raw));
      if (migrated) return migrated;
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
    endPromptFor: null,
    twoMinNotified: remaining <= 120,
  };
}

function localeOf(prefs: AppState["prefs"]) {
  const browser = typeof navigator === "undefined" ? "en" : navigator.language;
  return resolvedLocale(prefs.locale, browser);
}

function quietNow(prefs: AppState["prefs"], now = new Date()) {
  if (!prefs.quietHours) return false;
  return isQuietAt(now, prefs.quietStart ?? DEFAULT_QUIET_START, prefs.quietEnd ?? DEFAULT_QUIET_END);
}

function leadCopy(prefs: AppState["prefs"], minutes: number) {
  const locale = localeOf(prefs);
  return {
    body: translate(locale, "lead.body", { n: minutes }),
    title: translate(locale, "lead.title"),
  };
}

interface StartFocusOpts {
  minutes?: number;
  eventId?: string | null;
  label?: string;
  presetId?: string;
  linkedToBlock?: boolean;
}

interface Store {
  ready: boolean;
  state: AppState;
  setEnergy: (e: Energy) => void;
  addEvent: (e: Omit<NowEvent, "id" | "done" | "nudges" | "schedule"> & Partial<Pick<NowEvent, "nudges" | "schedule">>) => NowEvent;
  toggleDone: (id: string) => void;
  splitTask: (id: string) => void;
  setSteps: (id: string, steps: NowEvent["steps"]) => void;
  addBigWin: (input: { label: string; date: string; note?: string }) => void;
  setCustomParts: (hours: number, minutes: number) => ReturnType<typeof parseCustomDuration>;
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
  startLinkedTimer: (eventId: string) => { ok: true; ended: boolean } | { ok: false; message: string };
  extendLinked: (minutes: number, force?: boolean) => ExtendResult;
  finishLinked: () => void;
  dismissEndPrompt: () => void;
  endLinked: () => void;
  releaseLinked: () => void;
  commitSchedule: (id: string, input: ScheduleInput) => { ok: true } | { ok: false; message: string };
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
  const warnedDeadline = useRef<number | null>(null);
  const ringing = useRef<number | null>(null);
  const unlinkedDone = useRef<number | null>(null);

  useEffect(() => {
    setState(load());
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      const locale = localeOf(stateRef.current.prefs);
      toast(translate(locale, "storage.full"), { description: translate(locale, "storage.body") });
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

  const addWin = useCallback((label: string, eventId?: string) => {
    setState((s) => {
      if (eventId && s.wins.some((w) => (w.kind ?? "small") === "small" && w.eventId === eventId)) return s;
      return {
        ...s,
        wins: [...s.wins, { id: uid(), date: toDateKey(new Date()), label, kind: "small" as const, eventId }],
      };
    });
  }, []);

  // Wall-clock countdown. Background tabs and reloads read the deadline, not a drifted tick.
  useEffect(() => {
    if (!ready) return;
    const sync = () => {
      const s = stateRef.current;
      const f = s.focus;

      if (f.linkedToBlock && f.eventId && f.running) {
        const ev = s.events.find((e) => e.id === f.eventId);
        if (!ev) {
          setState((prev) => ({
            ...prev,
            focus: { ...prev.focus, running: false, linkedToBlock: false, endPromptFor: null },
          }));
          return;
        }
        const end = eventEndMs(ev);
        const remaining = Math.max(0, Math.ceil((end - Date.now()) / 1000));
        if (remaining <= 0) {
          if (ringing.current === end || f.alarmedAt === end) {
            if (f.running || f.endPromptFor !== end) {
              setState((prev) => ({
                ...prev,
                focus: {
                  ...prev.focus,
                  remainingSec: 0,
                  running: false,
                  endsAt: end,
                  finished: false,
                  alarmedAt: end,
                  endPromptFor: end,
                },
              }));
            }
            return;
          }
          ringing.current = end;
          if (!quietNow(s.prefs)) playBlockChime(String(end));
          setState((prev) => ({
            ...prev,
            focus: {
              ...prev.focus,
              remainingSec: 0,
              running: false,
              endsAt: end,
              finished: false,
              alarmedAt: end,
              endPromptFor: end,
            },
          }));
          return;
        }
        const leadMin = normalizeLead(s.prefs.focusLeadMin);
        const already = f.twoMinNotified || warnedDeadline.current === end;
        if (s.prefs.focusReminders && shouldLeadWarn(f.totalSec, remaining, leadMin, already)) {
          warnedDeadline.current = end;
          if (!quietNow(s.prefs)) {
            const copy = leadCopy(s.prefs, leadMin);
            notify(copy.body, { title: copy.title });
          }
        }
        if (remaining !== f.remainingSec || f.endsAt !== end || (warnedDeadline.current === end && !f.twoMinNotified)) {
          setState((prev) => ({
            ...prev,
            focus: {
              ...prev.focus,
              remainingSec: remaining,
              endsAt: end,
              twoMinNotified: warnedDeadline.current === end || prev.focus.twoMinNotified,
            },
          }));
        }
        return;
      }

      if (f.running && f.endsAt && !f.linkedToBlock) {
        const remaining = Math.max(0, Math.ceil((f.endsAt - Date.now()) / 1000));
        let next: FocusState = { ...f, remainingSec: remaining };
        const leadMin = normalizeLead(s.prefs.focusLeadMin);
        const already = f.twoMinNotified || warnedDeadline.current === f.endsAt;
        if (s.prefs.focusReminders && f.endsAt && shouldLeadWarn(f.totalSec, remaining, leadMin, already)) {
          warnedDeadline.current = f.endsAt;
          next.twoMinNotified = true;
          if (!quietNow(s.prefs)) {
            const copy = leadCopy(s.prefs, leadMin);
            notify(copy.body, { title: copy.title });
          }
        }
        if (remaining === 0) {
          next = { ...next, running: false, endsAt: null, finished: true };
          if (unlinkedDone.current !== f.endsAt) {
            unlinkedDone.current = f.endsAt;
            const locale = localeOf(s.prefs);
            if (!quietNow(s.prefs)) {
              notify(translate(locale, "timer.doneBody"), { title: translate(locale, "timer.doneTitle") });
            }
          }
        }
        if (remaining !== f.remainingSec || next.finished || next.twoMinNotified !== f.twoMinNotified) {
          setState((prev) => ({ ...prev, focus: next.finished || next.twoMinNotified ? next : { ...prev.focus, remainingSec: remaining } }));
        }
      }
    };
    sync();
    const id = window.setInterval(sync, 500);
    document.addEventListener("visibilitychange", sync);
    window.addEventListener("focus", sync);
    window.addEventListener("pageshow", sync);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", sync);
      window.removeEventListener("focus", sync);
      window.removeEventListener("pageshow", sync);
    };
  }, [ready]);

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
          if (!nudgeTierAllowed(s.prefs, ev.nudges[tier.key], tier.key)) continue;
          const key = `${ev.id}:${tier.key}`;
          if (s.firedNudges.includes(key)) continue;
          const target = at - tier.offsetMin * 60_000;
          const diff = now.getTime() - target;
          if (diff >= 0 && diff < 5 * 60_000) {
            fired.push(key);
            if (!quietNow(s.prefs, now)) {
              const locale = localeOf(s.prefs);
              notify(translate(locale, `nudge.${tier.key}`, { title: ev.title, time: formatLocaleTime(ev.time, locale) }));
            }
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
          nudges: e.nudges ?? stateRef.current.prefs.nudgeDefaults ?? DEFAULT_NUDGES,
          ...e,
          schedule: e.schedule === "fixed" ? "fixed" : "flexible",
        };
        update((s) => ({ ...s, events: [...s.events, full] }));
        return full;
      },
      toggleDone: (id) => {
        const ev = stateRef.current.events.find((e) => e.id === id);
        if (ev && !ev.done) addWin(ev.title, ev.id);
        updateEvent(id, (e) => {
          const next: NowEvent = { ...e, done: !e.done };
          if (e.steps) next.steps = e.steps.map((st) => ({ ...st, done: !e.done ? true : st.done }));
          return next;
        });
      },
      splitTask: (id) =>
        updateEvent(id, (e) => (e.steps?.length ? e : { ...e, steps: splitIntoSteps(e.title) })),
      setSteps: (id, steps) => updateEvent(id, (e) => ({ ...e, steps })),
      addBigWin: (input) =>
        update((s) => ({
          ...s,
          wins: [
            ...s.wins,
            {
              id: uid(),
              date: input.date,
              label: input.label.trim(),
              note: input.note?.trim() || undefined,
              kind: "big" as const,
            },
          ],
        })),
      setCustomParts: (hours, minutes) => {
        const parsed = parseCustomDuration(String(hours), String(minutes));
        if (!parsed.ok) return parsed;
        updateFocus((f) => {
          const stored = { ...f, customHours: parsed.hours, customMinutes: parsed.minutes, customMin: parsed.total };
          if (f.running || f.linkedToBlock || f.presetId !== "custom") return stored;
          return {
            ...stored,
            totalSec: parsed.total * 60,
            remainingSec: parsed.total * 60,
            endsAt: null,
            finished: false,
            twoMinNotified: false,
          };
        });
        return parsed;
      },
      toggleStep: (eventId, stepId) => {
        const ev = stateRef.current.events.find((e) => e.id === eventId);
        if (!ev) return;
        const next = toggleStepPure(ev, stepId);
        updateEvent(eventId, () => next);
      },
      toggleNudge: (eventId, key) =>
        updateEvent(eventId, (e) => ({ ...e, nudges: { ...e.nudges, [key]: !e.nudges[key] } })),
      previewNudges: (eventId) => {
        const ev = stateRef.current.events.find((e) => e.id === eventId);
        if (!ev) return;
        const tiers = NUDGE_TIERS.filter((t) => ev.nudges[t.key]);
        if (!tiers.length) {
          const locale = localeOf(stateRef.current.prefs);
          toast(translate(locale, "nudge.none"), { description: translate(locale, "nudge.noneBody") });
          return;
        }
        const locale = localeOf(stateRef.current.prefs);
        const nudgeKey = { day: "nudge.day", hour: "nudge.hour", ten: "nudge.ten", now: "nudge.now" } as const;
        tiers.forEach((t, i) =>
          window.setTimeout(
            () => notify(translate(locale, nudgeKey[t.key], { title: ev.title, time: formatLocaleTime(ev.time, locale) })),
            i * 1400,
          ),
        );
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
          if (f.running || f.linkedToBlock) return f;
          const p = FOCUS_PRESETS.find((x) => x.id === id);
          const minutes = id === "custom" ? f.customMin : (p?.minutes ?? 25);
          return {
            ...f,
            presetId: id,
            label: p?.label ?? f.label,
            eventId: null,
            linkedToBlock: false,
            endPromptFor: null,
            alarmedAt: null,
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
        setState((s) => {
          const f = s.focus;
          if (!opts && f.linkedToBlock && f.eventId) {
            const ev = s.events.find((e) => e.id === f.eventId);
            if (ev && scheduleOf(ev) === "flexible") {
              const plan = planBlockTimer(ev, new Date());
              if (plan.ended) {
                return {
                  ...s,
                  focus: {
                    ...f,
                    running: false,
                    remainingSec: 0,
                    endsAt: plan.endsAt,
                    finished: false,
                    alarmedAt: plan.endsAt,
                    endPromptFor: plan.endsAt,
                  },
                };
              }
              return {
                ...s,
                focus: {
                  ...f,
                  running: true,
                  endsAt: plan.endsAt,
                  remainingSec: plan.remainingSec,
                  totalSec: Math.max(f.totalSec, plan.remainingSec),
                  finished: false,
                  endPromptFor: null,
                  twoMinNotified: plan.remainingSec <= 120,
                },
              };
            }
          }
          const minutes = opts?.minutes;
          const totalSec = minutes ? minutes * 60 : f.totalSec;
          const remaining = minutes ? minutes * 60 : f.finished || f.remainingSec <= 0 ? f.totalSec : f.remainingSec;
          const replacingLink = opts?.eventId !== undefined;
          return {
            ...s,
            focus: {
              ...f,
              presetId: opts?.presetId ?? f.presetId,
              label: opts?.label ?? f.label,
              eventId: opts?.eventId !== undefined ? opts.eventId : f.eventId,
              linkedToBlock: replacingLink ? !!opts?.linkedToBlock : f.linkedToBlock,
              totalSec,
              remainingSec: remaining,
              running: true,
              endsAt: Date.now() + remaining * 1000,
              finished: false,
              endPromptFor: null,
              twoMinNotified: minutes ? false : f.twoMinNotified,
              alarmedAt: minutes ? null : f.alarmedAt,
            },
          };
        }),
      pauseFocus: () =>
        setState((s) => {
          const f = s.focus;
          let remaining = f.remainingSec;
          if (f.linkedToBlock && f.eventId) {
            const ev = s.events.find((e) => e.id === f.eventId);
            if (ev) remaining = planBlockTimer(ev, new Date()).remainingSec;
          } else if (f.endsAt) {
            remaining = Math.max(0, Math.ceil((f.endsAt - Date.now()) / 1000));
          }
          return { ...s, focus: { ...f, running: false, endsAt: null, remainingSec: remaining } };
        }),
      resumeFocus: () =>
        setState((s) => {
          const f = s.focus;
          if (f.linkedToBlock && f.eventId) {
            const ev = s.events.find((e) => e.id === f.eventId);
            if (ev) {
              const plan = planBlockTimer(ev, new Date());
              if (plan.ended) {
                if (f.alarmedAt !== plan.endsAt && !quietNow(s.prefs)) playBlockChime(String(plan.endsAt));
                return {
                  ...s,
                  focus: {
                    ...f,
                    running: false,
                    remainingSec: 0,
                    endsAt: plan.endsAt,
                    finished: false,
                    alarmedAt: plan.endsAt,
                    endPromptFor: plan.endsAt,
                  },
                };
              }
              return {
                ...s,
                focus: {
                  ...f,
                  running: true,
                  endsAt: plan.endsAt,
                  remainingSec: plan.remainingSec,
                  totalSec: Math.max(f.totalSec, plan.remainingSec),
                  finished: false,
                  endPromptFor: null,
                },
              };
            }
          }
          return { ...s, focus: { ...f, running: true, endsAt: Date.now() + f.remainingSec * 1000, finished: false } };
        }),
      resetFocus: () =>
        setState((s) => {
          const f = s.focus;
          if (f.linkedToBlock && f.eventId) {
            const ev = s.events.find((e) => e.id === f.eventId);
            if (ev) {
              const plan = planBlockTimer(ev, new Date());
              return {
                ...s,
                focus: {
                  ...f,
                  running: false,
                  endsAt: null,
                  remainingSec: plan.remainingSec,
                  totalSec: Math.max(plan.remainingSec, 1),
                  finished: false,
                  endPromptFor: null,
                  twoMinNotified: false,
                },
              };
            }
          }
          return {
            ...s,
            focus: {
              ...f,
              running: false,
              endsAt: null,
              remainingSec: f.totalSec,
              finished: false,
              twoMinNotified: false,
              endPromptFor: null,
            },
          };
        }),
      extendFocus: (min) => updateFocus((f) => (f.linkedToBlock ? f : extendFocusState(f, min))),
      startLinkedTimer: (eventId) => {
        const s = stateRef.current;
        const ev = s.events.find((e) => e.id === eventId);
        if (!ev) return { ok: false, message: translate(localeOf(stateRef.current.prefs), "timer.missing") };
        if (scheduleOf(ev) !== "flexible") {
          return { ok: false, message: translate(localeOf(stateRef.current.prefs), "timer.fixedSeparate") };
        }
        const plan = planBlockTimer(ev, new Date());
        setState((prev) => ({
          ...prev,
          focus: {
            ...prev.focus,
            presetId: "event",
            label: ev.title,
            eventId: ev.id,
            linkedToBlock: true,
            totalSec: plan.ended ? Math.max(ev.duration * 60, 1) : Math.max(plan.remainingSec, 1),
            remainingSec: plan.remainingSec,
            running: !plan.ended,
            endsAt: plan.ended ? plan.endsAt : plan.endsAt,
            finished: false,
            twoMinNotified: plan.remainingSec <= 120,
            alarmedAt: plan.ended ? plan.endsAt : null,
            endPromptFor: plan.ended ? plan.endsAt : null,
          },
        }));
        return { ok: true, ended: plan.ended };
      },
      extendLinked: (minutes, force = false) => {
        const s = stateRef.current;
        const id = s.focus.eventId;
        if (!id || !s.focus.linkedToBlock) return { ok: false, message: translate(localeOf(s.prefs), "timer.needStart") };
        const ev = s.events.find((e) => e.id === id);
        if (!ev) return { ok: false, message: translate(localeOf(s.prefs), "timer.missing") };
        if (scheduleOf(ev) !== "flexible") {
          return { ok: false, message: translate(localeOf(s.prefs), "timer.fixedStay") };
        }
        const planned = planExtension(ev, minutes, new Date());
        if (!planned.ok) return { ok: false, message: explainScheduleError(localeOf(s.prefs), planned) };
        const hit = fixedConflict(s.events, ev.id, eventStartMs(ev), planned.plan.endMs, Date.now());
        if (hit && !force) {
          const locale = localeOf(s.prefs);
          return {
            ok: false,
            reason: "conflict",
            message: translate(locale, "conflict.overlap", { title: hit.title, time: formatLocaleTime(hit.time, locale) }),
            minutes,
          };
        }
        const endMs = planned.plan.endMs;
        const remaining = Math.max(1, Math.ceil((endMs - Date.now()) / 1000));
        warnedDeadline.current = null;
        setState((prev) => ({
          ...prev,
          events: prev.events.map((e) => (e.id === id ? { ...e, duration: planned.plan.duration } : e)),
          focus: {
            ...prev.focus,
            label: ev.title,
            eventId: id,
            linkedToBlock: true,
            running: true,
            endsAt: endMs,
            remainingSec: remaining,
            totalSec: remaining,
            finished: false,
            endPromptFor: null,
            twoMinNotified: remaining <= 120,
          },
        }));
        return { ok: true };
      },
      finishLinked: () => {
        const f = stateRef.current.focus;
        if (f.eventId) {
          const ev = stateRef.current.events.find((e) => e.id === f.eventId);
          if (ev && !ev.done) addWin(ev.title, ev.id);
          updateEvent(f.eventId, (e) => ({
            ...e,
            done: true,
            steps: e.steps?.map((st) => ({ ...st, done: true })),
          }));
        }
        updateFocus((x) => ({
          ...x,
          running: false,
          endsAt: null,
          finished: false,
          endPromptFor: null,
          linkedToBlock: false,
          remainingSec: 0,
        }));
      },
      dismissEndPrompt: () =>
        setState((s) => {
          const f = s.focus;
          let remaining = f.remainingSec;
          if (f.linkedToBlock && f.eventId) {
            const ev = s.events.find((e) => e.id === f.eventId);
            if (ev) remaining = planBlockTimer(ev, new Date()).remainingSec;
          }
          return { ...s, focus: { ...f, endPromptFor: null, running: false, remainingSec: remaining } };
        }),
      endLinked: () =>
        setState((s) => {
          const f = s.focus;
          const ev = f.eventId ? s.events.find((e) => e.id === f.eventId) : undefined;
          if (!ev) return { ...s, focus: { ...f, running: false, endPromptFor: f.endsAt } };
          const plan = planBlockTimer(ev, new Date());
          return {
            ...s,
            focus: {
              ...f,
              running: false,
              endsAt: null,
              remainingSec: plan.remainingSec,
              finished: false,
              endPromptFor: plan.endsAt,
              alarmedAt: plan.ended ? plan.endsAt : f.alarmedAt,
            },
          };
        }),
      releaseLinked: () =>
        setState((s) => ({
          ...s,
          focus: defaultFocus({
            bodyDouble: s.focus.bodyDouble,
            customMin: s.focus.customMin,
            presetId: "study",
            label: "Study",
            totalSec: 25 * 60,
            remainingSec: 25 * 60,
          }),
        })),
      commitSchedule: (id, raw) => {
        const input = { ...raw, time: normalizeTime(raw.time) };
        const check = validateSlot(input);
        if (!check.ok) return check;
        const ev = stateRef.current.events.find((e) => e.id === id);
        if (!ev) return { ok: false, message: translate(localeOf(stateRef.current.prefs), "timer.missing") };
        const next = applyReschedule(ev, input);
        const moved = slotChanged(ev, input);
        setState((prev) => {
          let focus = prev.focus;
          if (focus.eventId === id && focus.linkedToBlock) {
            if (next.schedule === "fixed") {
              focus = { ...focus, linkedToBlock: false, endPromptFor: null, running: false, endsAt: null };
            } else {
              const plan = planBlockTimer(next, new Date());
              focus = {
                ...focus,
                label: next.title,
                endsAt: plan.endsAt,
                remainingSec: plan.remainingSec,
                running: focus.running && !plan.ended,
                finished: false,
                endPromptFor: plan.ended ? plan.endsAt : null,
                alarmedAt: plan.ended ? plan.endsAt : focus.alarmedAt,
                totalSec: Math.max(focus.totalSec, plan.remainingSec, 1),
              };
            }
          }
          return {
            ...prev,
            events: prev.events.map((e) => (e.id === id ? next : e)),
            firedNudges: moved ? clearFiredFor(prev.firedNudges, id) : prev.firedNudges,
            focus,
          };
        });
        return { ok: true };
      },
      setBodyDouble: (on) => updateFocus((f) => ({ ...f, bodyDouble: on })),
      checkIn: (choice) => {
        const f = stateRef.current.focus;
        if (f.linkedToBlock) return;
        if (choice === "more") {
          updateFocus((x) => extendFocusState(x, 5));
          return;
        }
        addWin(
          f.label ||
            translate(
              resolvedLocale(
                stateRef.current.prefs.locale,
                typeof navigator === "undefined" ? undefined : navigator.language,
              ),
              "focus.session",
            ),
          f.eventId ?? undefined,
        );
        if (f.eventId) {
          updateEvent(f.eventId, (e) => ({ ...e, done: true }));
        }
        updateFocus((x) => ({ ...x, finished: false, remainingSec: x.totalSec, twoMinNotified: false, running: false }));
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
