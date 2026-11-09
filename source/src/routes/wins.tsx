import { createFileRoute } from "@tanstack/react-router";
import { Plus, Trophy } from "lucide-react";
import { useState } from "react";

import { Loading } from "@/components/nowmode/Loading";
import { ScreenHeader } from "@/components/nowmode/ScreenHeader";
import { Button } from "@/components/ui/button";
import { useT, useLocale } from "@/lib/i18n/context";
import { formatLocaleDate } from "@/lib/i18n/format";
import { useNowMode } from "@/lib/nowmode/store";
import type { Win } from "@/lib/nowmode/types";

export const Route = createFileRoute("/wins")({
  head: () => ({
    meta: [{ title: "Wins · Now Mode" }, { name: "description", content: "Small wins and big accomplishments. No score and no streak." }],
  }),
  component: WinsScreen,
});

function WinsScreen() {
  const t = useT();
  const { ready, state } = useNowMode();
  const [open, setOpen] = useState(false);
  if (!ready) return <Loading />;
  const small = state.wins.filter((w) => (w.kind ?? "small") === "small");
  const big = state.wins.filter((w) => w.kind === "big");

  return (
    <div className="pb-8">
      <ScreenHeader back title={t("wins.title")} />
      <div className="space-y-6 px-5">
        <p className="text-sm leading-relaxed text-muted-foreground">{t("wins.intro")}</p>
        {state.wins.length === 0 && (
          <p className="rounded-2xl border border-border bg-card px-4 py-5 text-sm leading-relaxed text-muted-foreground">{t("wins.empty")}</p>
        )}
        <WinList title={t("wins.small")} empty={t("wins.smallEmpty")} items={small} />
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">{t("wins.big")}</h2>
            <Button size="sm" className="h-9 rounded-xl" onClick={() => setOpen(true)}>
              <Plus /> {t("wins.add")}
            </Button>
          </div>
          {big.length === 0 && <p className="rounded-2xl border border-border bg-bg2 px-4 py-3 text-sm text-dim">{t("wins.bigEmpty")}</p>}
          {big.map((win) => (
            <WinCard key={win.id} win={win} big />
          ))}
        </section>
      </div>
      {open && <BigWinForm onClose={() => setOpen(false)} />}
    </div>
  );
}

function WinList({ title, empty, items }: { title: string; empty: string; items: Win[] }) {
  return (
    <section className="space-y-2">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <Trophy className="size-4 text-teal" aria-hidden /> {title}
      </h2>
      {items.length === 0 && <p className="rounded-2xl border border-border bg-bg2 px-4 py-3 text-sm text-dim">{empty}</p>}
      {items.map((win) => (
        <WinCard key={win.id} win={win} />
      ))}
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
