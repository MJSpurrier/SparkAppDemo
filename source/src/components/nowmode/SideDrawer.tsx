import { Link } from "@tanstack/react-router";
import { CalendarDays, CircleHelp, HandHeart, Home, MessageSquareText, Shield, Sparkles, Target, Trophy, UserRound, Waypoints, X } from "lucide-react";
import { Avatar } from "./Avatar";
import { useEffect } from "react";

import { useT } from "@/lib/i18n/context";
import type { MessageKey } from "@/lib/i18n/messages";
import { greetingName } from "@/lib/nowmode/profile";
import { useNowMode } from "@/lib/nowmode/store";
import { toDateKey } from "@/lib/nowmode/logic";
import { Logo } from "./Logo";
import { useUI } from "./ui-context";

const rail = [
  { to: "/", label: "nav.today", icon: Home },
  { to: "/calendar", label: "nav.calendar", icon: CalendarDays },
  { to: "/board", label: "nav.board", icon: Waypoints },
  { to: "/focus", label: "nav.focus", icon: Target },
  { to: "/wins", label: "nav.wins", icon: Trophy },
] as const;

function greetingLine(prefs: Parameters<typeof greetingName>[0], fallback: string) {
  return greetingName(prefs) || fallback;
}

const destinations = [
  { to: "/account", label: "nav.account", hint: "drawer.accountHint", icon: UserRound },
  { to: "/mission", label: "nav.mission", hint: "drawer.missionHint", icon: Sparkles },
  { to: "/support", label: "nav.support", hint: "drawer.supportHint", icon: HandHeart },
  { to: "/feedback", label: "nav.feedback", hint: "drawer.feedbackHint", icon: MessageSquareText },
  { to: "/privacy", label: "nav.privacy", hint: "drawer.privacyHint", icon: Shield },
] as const;

export function SideDrawer() {
  const t = useT();
  const { drawerOpen, setDrawerOpen, startTutorial } = useUI();
  const { state } = useNowMode();
  const close = () => setDrawerOpen(false);

  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setDrawerOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawerOpen, setDrawerOpen]);

  if (!drawerOpen) return null;
  const winsToday = state.wins.filter((w) => w.date === toDateKey(new Date())).length;

  return (
    <div className="absolute inset-0 z-40" role="dialog" aria-modal="true" aria-label={t("nav.menu")}>
      <button
        type="button"
        aria-label={t("nav.close")}
        onClick={close}
        className="animate-fade-soft absolute inset-0 bg-ink/70 backdrop-blur-[2px]"
      />
      <aside className="animate-drawer-in absolute inset-y-0 left-0 flex w-[80%] border-r border-border bg-bg2 shadow-shell">
        {/* Server-style rail */}
        <div className="flex w-[68px] shrink-0 flex-col items-center gap-3 border-r border-border bg-background py-5">
          <Logo size={44} />
          <div className="h-px w-8 bg-border2" />
          {rail.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              onClick={close}
              aria-label={t(label)}
              activeOptions={{ exact: true }}
              className="grid size-11 place-items-center rounded-2xl bg-card text-muted-foreground transition-all hover:rounded-xl hover:text-foreground data-[status=active]:rounded-xl data-[status=active]:bg-blue data-[status=active]:text-primary-foreground"
            >
              <Icon className="size-5" strokeWidth={1.8} />
            </Link>
          ))}
        </div>

        {/* Channel column */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center justify-between border-b border-border px-4 py-5">
            <div className="min-w-0">
              <p className="truncate text-base font-bold">{t("app.name")}</p>
              <p className="truncate text-xs text-muted-foreground">{t("drawer.tagline")}</p>
            </div>
            <button
              type="button"
              aria-label={t("nav.close")}
              onClick={close}
              className="grid size-8 shrink-0 place-items-center rounded-lg text-dim hover:bg-card hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          </div>

          <nav className="flex-1 overflow-y-auto px-2 py-4" aria-label={t("nav.more")}>
            <p className="px-2 pb-2 text-[11px] font-bold uppercase tracking-wider text-dim">{t("drawer.section")}</p>
            <ul className="space-y-1">
              <li>
                <button
                  type="button"
                  onClick={() => {
                    close();
                    startTutorial();
                  }}
                  className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
                >
                  <CircleHelp className="size-[18px] shrink-0" strokeWidth={1.8} />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">{t("nav.tutorial")}</span>
                    <span className="block truncate text-[11px] text-dim">{t("drawer.tutorialHint")}</span>
                  </span>
                </button>
              </li>
              {destinations.map(({ to, label, hint, icon: Icon }) => (
                <li key={to}>
                  <Link
                    to={to}
                    onClick={close}
                    className="flex items-center gap-3 rounded-xl px-2 py-2.5 text-muted-foreground transition-colors hover:bg-card hover:text-foreground data-[status=active]:bg-card2 data-[status=active]:text-foreground"
                  >
                    <Icon className="size-[18px] shrink-0" strokeWidth={1.8} />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold">{t(label)}</span>
                      <span className="block truncate text-[11px] text-dim">{t(hint)}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="flex items-center gap-3 border-t border-border bg-background/60 px-4 py-3">
            <Avatar prefs={state.prefs} />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{greetingLine(state.prefs, t("drawer.you"))}</p>
              <p className="truncate text-[11px] text-green">● {t("drawer.winsToday", { n: winsToday })}</p>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}