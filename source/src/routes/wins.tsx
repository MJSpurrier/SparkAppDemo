import { createFileRoute } from "@tanstack/react-router";
import { ChevronDown, Plus, Trophy } from "lucide-react";
import { useState, type ReactNode } from "react";

import { Loading } from "@/components/nowmode/Loading";
import { ScreenHeader } from "@/components/nowmode/ScreenHeader";
import { Button } from "@/components/ui/button";
import { useT, useLocale } from "@/lib/i18n/context";
import { formatLocaleDate } from "@/lib/i18n/format";
import { useNowMode } from "@/lib/nowmode/store";
import type { Win } from "@/lib/nowmode/types";
import { weekStartsOn, winInSpan, type WinSpan } from "@/lib/nowmode/wins";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/wins")({
  head: () => ({
    meta: [{ title: "Wins · Now Mode" }, { name: "description", content: "Small wins and big accomplishments. No score and no streak." }],
  }),
  component: WinsScreen,
});

function WinsScreen() {
  const t = useT();
  const locale = useLocale();
  const { ready, state } = useNowMode();
  const [open, setOpen] = useState(false);
  const [span, setSpan] = useState<WinSpan>("all");
  const [smallOpen, setSmallOpen] = useState(true);
  const [bigOpen, setBigOpen] = useState(true);
  if (!ready) return <Loading />;
  const now = new Date();
  const weekStart = weekStartsOn(locale);
  const small = state.wins.filter((w) => (w.kind ?? "small") === "small");
  const big = state.wins.filter((w) => w.kind === "big");
  const visible = (items: Win[]) => items.filter((win) => winInSpan(win.date, span, now, weekStart));
  const spans: WinSpan[] = ["all", "week", "month", "year"];

  return (
    <div className="pb-8">
      <ScreenHeader back title={t("wins.title")} />
      <div className="space-y-5 px-5">
        <p className="text-sm leading-relaxed text-muted-foreground">{t("wins.intro")}</p>
        <div className="grid grid-cols-4 gap-1 rounded-2xl border border-border bg-card p-1" role="radiogroup" aria-label={t("wins.span.all")}>
          {spans.map((item) => (
            <button
              key={item}
              type="button"
              role="radio"
              aria-checked={span === item}
              onClick={() => setSpan(item)}
              className={cn(
                "rounded-xl px-1 py-2 text-[11px] font-semibold",
                span === item ? "bg-blue/15 text-blue" : "text-muted-foreground",
              )}
            >
              {t(item === "all" ? "wins.span.all" : item === "week" ? "wins.span.week" : item === "month" ? "wins.span.month" : "wins.span.year")}
            </button>
          ))}
        </div>
        {state.wins.length === 0 && (
          <p className="rounded-2xl border border-border bg-card px-4 py-5 text-sm leading-relaxed text-muted-foreground">{t("wins.empty")}</p>
        )}
        <WinGroup
          title={t("wins.small")}
          total={small.length}
          items={visible(small)}
          empty={span === "all" ? t("wins.smallEmpty") : t("wins.filterEmpty")}
          expanded={smallOpen}
          onToggle={() => setSmallOpen((v) => !v)}
        />
        <WinGroup
          title={t("wins.big")}
          total={big.length}
          items={visible(big)}
          empty={span === "all" ? t("wins.bigEmpty") : t("wins.filterEmpty")}
          expanded={bigOpen}
          onToggle={() => setBigOpen((v) => !v)}
          gold
          action={
            <Button size="sm" className="h-9 rounded-xl" onClick={() => setOpen(true)}>
              <Plus /> {t("wins.add")}
            </Button>
          }
        />
      </div>
      {open && <BigWinForm onClose={() => setOpen(false)} />}
    </div>
  );
}

function WinGroup({
  title,
  total,
  items,
  empty,
  expanded,
  onToggle,
  gold = false,
  action,
}: {
  title: string;
  total: number;
  items: Win[];
  empty: string;
  expanded: boolean;
  onToggle: () => void;
  gold?: boolean;
  action?: ReactNode;
}) {
  const t = useT();
  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-expanded={expanded}
          aria-label={t(expanded ? "wins.collapse" : "wins.expand", { title })}
          onClick={onToggle}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          <Trophy className={cn("size-4 shrink-0", gold ? "trophy-gold" : "text-teal")} aria-hidden />
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold">{title}</span>
            <span className="block text-[11px] text-dim">{t("wins.total", { n: total })}</span>
          </span>
          <ChevronDown className={cn("size-4 shrink-0 text-dim transition-transform", expanded && "rotate-180")} aria-hidden />
        </button>
        {action}
      </div>
      {expanded && items.length === 0 && <p className="rounded-2xl border border-border bg-bg2 px-4 py-3 text-sm text-dim">{empty}</p>}
      {expanded && items.map((win) => <WinCard key={win.id} win={win} />)}
    </section>
  );
}

function WinCard({ win, big = false }: { win: Win; big?: boolean }) {
  const locale = useLocale();
  const [y = 2026, m = 1, d = 1] = win.date.split("-").map(Number);
  const when = formatLocaleDate(new Date(y, m - 1, d), locale, { month: "short", day: "numeric", year: "numeric" });
  return (
    <article className="rounded-2xl border border-border bg-card px-4 py-3">
      <p className="text-sm font-semibold">{win.label}</p>
      <p className="mt-0.5 text-xs text-dim">
        {when}
        {big ? "" : ""}
      </p>
      {win.note && <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{win.note}</p>}
    </article>
  );
}

function BigWinForm({ onClose }: { onClose: () => void }) {
  const t = useT();
  const { addBigWin } = useNowMode();
  const [label, setLabel] = useState("");
  const [date, setDate] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  });
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="fixed inset-0 z-40" role="dialog" aria-modal="true" aria-labelledby="big-win-title">
      <button type="button" className="absolute inset-0 bg-ink/70" aria-label={t("common.cancel")} onClick={onClose} />
      <form
        className="animate-sheet-up absolute inset-x-0 bottom-0 space-y-3 rounded-t-3xl border-x border-t border-border2 bg-bg2 px-5 pb-6 pt-4 shadow-shell"
        onSubmit={(e) => {
          e.preventDefault();
          if (!label.trim()) {
            setError(t("wins.need"));
            return;
          }
          addBigWin({ label: label.trim(), date, note });
          onClose();
        }}
      >
        <h2 id="big-win-title" className="text-lg font-bold">
          {t("wins.form")}
        </h2>
        <label className="block text-xs font-semibold">
          {t("wins.name")}
          <input
            required
            value={label}
            placeholder={t("wins.namePh")}
            onChange={(e) => {
              setLabel(e.target.value);
              setError(null);
            }}
            className="mt-1 h-11 w-full rounded-xl border border-border2 bg-card px-3 text-sm focus:border-blue focus:outline-none"
          />
        </label>
        <label className="block text-xs font-semibold">
          {t("wins.date")}
          <input
            type="date"
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="mt-1 h-11 w-full rounded-xl border border-border2 bg-card px-3 text-sm focus:border-blue focus:outline-none"
          />
        </label>
        <label className="block text-xs font-semibold">
          {t("wins.note")}
          <textarea
            value={note}
            placeholder={t("wins.notePh")}
            rows={3}
            onChange={(e) => setNote(e.target.value)}
            className="mt-1 w-full resize-none rounded-xl border border-border2 bg-card px-3 py-2 text-sm focus:border-blue focus:outline-none"
          />
        </label>
        {error && (
          <p role="alert" className="text-xs text-coral">
            {error}
          </p>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Button type="button" variant="secondary" className="h-12 rounded-xl" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" className="h-12 rounded-xl">
            {t("wins.save")}
          </Button>
        </div>
      </form>
    </div>
  );
}
