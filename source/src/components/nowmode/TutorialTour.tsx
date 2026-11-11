import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";

import { useT } from "@/lib/i18n/context";
import type { MessageKey } from "@/lib/i18n/messages";
import { hadSavedNowMode, useNowMode } from "@/lib/nowmode/store";
import { TUTORIAL_STEPS, isLastStep, nextStep, placeTourCard, previousStep, shouldAutoStart } from "@/lib/nowmode/tutorial";

import { useUI } from "./ui-context";

export function TutorialTour() {
  const t = useT();
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { ready, state, setPrefs } = useNowMode();
  const { tutorialNonce } = useUI();
  const [session, setSession] = useState(0);
  const [index, setIndex] = useState(0);
  const [returnTo, setReturnTo] = useState("/");
  const [box, setBox] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  const [cardTop, setCardTop] = useState(80);
  const frameRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const offered = useRef(false);
  const open = session > 0;
  const step = TUTORIAL_STEPS[index] ?? TUTORIAL_STEPS[0];
  const reduceMotion = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const finish = useCallback(
    (back: string) => {
      setPrefs({ tutorialDone: true });
      setSession(0);
      void navigate({ to: back as "/" | "/focus" | "/wins" | "/calendar" | "/board" | "/account" | "/mission" });
    },
    [navigate, setPrefs],
  );

  useEffect(() => {
    if (!ready || offered.current) return;
    const saved = hadSavedNowMode();
    if (!saved && !state.prefs.accountReady) return;
    offered.current = true;
    if (shouldAutoStart(saved, state.prefs.tutorialDone, !!state.prefs.accountReady)) {
      setReturnTo(path);
      setIndex(0);
      setSession(1);
    }
  }, [ready, state.prefs.accountReady, state.prefs.tutorialDone, path]);

  useEffect(() => {
    if (!tutorialNonce) return;
    setReturnTo(path);
    setIndex(0);
    setSession(tutorialNonce);
  }, [tutorialNonce]);

  useEffect(() => {
    if (!open) return;
    void navigate({ to: step.route });
  }, [open, step.route, navigate]);

  useEffect(() => {
    if (!open) return;
    const measure = () => {
      const frame = frameRef.current?.parentElement?.getBoundingClientRect();
      const card = cardRef.current?.getBoundingClientRect();
      if (!frame) return;
      const target = step.target ? document.querySelector(`[data-tour="${step.target}"]`) : null;
      target?.scrollIntoView({ block: "center", behavior: "auto" });
      const rect = target?.getBoundingClientRect();
      const hole = rect
        ? {
            top: Math.max(8, rect.top - frame.top - 6),
            left: Math.max(8, rect.left - frame.left - 6),
            width: Math.min(frame.width - 16, rect.width + 12),
            height: rect.height + 12,
          }
        : null;
      setBox(hole);
      const placed = placeTourCard(
        { width: frame.width, height: frame.height },
        hole,
        card?.height ?? 220,
      );
      setCardTop(placed.top);
    };
    const id = window.setTimeout(measure, 60);
    window.addEventListener("resize", measure);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener("resize", measure);
    };
  }, [open, index, step.target, path, reduceMotion]);

  useEffect(() => {
    if (!open) return;
    nextRef.current?.focus();
  }, [open, index]);

  if (!open) return null;
  const last = isLastStep(index);

  const onKey = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      finish(returnTo);
      return;
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      if (last) finish(returnTo);
      else setIndex(nextStep(index));
      return;
    }
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      setIndex(previousStep(index));
      return;
    }
    if (event.key !== "Tab" || !cardRef.current) return;
    const items = [...cardRef.current.querySelectorAll<HTMLElement>("button")];
    if (!items.length) return;
    const first = items[0];
    const end = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      end?.focus();
    } else if (!event.shiftKey && document.activeElement === end) {
      event.preventDefault();
      first?.focus();
    }
  };

  return (
    <div ref={frameRef} className="absolute inset-0 z-50" role="presentation">
      <div className="absolute inset-0" />
      {!box && <div className="pointer-events-none absolute inset-0 bg-ink/70" />}
      {box && (
        <div
          className="pointer-events-none absolute rounded-2xl ring-2 ring-cream"
          style={{ top: box.top, left: box.left, width: box.width, height: box.height, boxShadow: "0 0 0 9999px color-mix(in oklab, var(--ink) 72%, transparent)" }}
        />
      )}
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        tabIndex={-1}
        onKeyDown={onKey}
        className={`absolute inset-x-3 max-h-[70%] overflow-y-auto rounded-[20px] border border-border2 bg-card p-4 text-foreground shadow-shell ${reduceMotion ? "" : "animate-fade-soft"}`}
        style={{ top: cardTop }}
      >
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-blue">
          {t("tour.progress", { n: index + 1, total: TUTORIAL_STEPS.length })}
        </p>
        <h2 id="tour-title" className="mt-1 text-lg font-bold">
          {t(`tour.${step.id}.title` as MessageKey)}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t(`tour.${step.id}.body` as MessageKey)}</p>
        <div className="mt-4 flex items-center gap-2">
          <button type="button" className="h-11 flex-1 rounded-xl border border-border2 text-sm font-semibold" onClick={() => setIndex(previousStep(index))} disabled={index === 0}>
            {t("tour.back")}
          </button>
          <button
            ref={nextRef}
            type="button"
            className="h-11 flex-1 rounded-xl bg-primary text-sm font-semibold text-primary-foreground"
            onClick={() => (last ? finish(returnTo) : setIndex(nextStep(index)))}
          >
            {last ? t("tour.finish") : t("tour.next")}
          </button>
        </div>
        <button type="button" className="mt-2 h-10 w-full text-sm font-semibold text-dim" onClick={() => finish(returnTo)}>
          {t("tour.skip")}
        </button>
      </div>
    </div>
  );
}
