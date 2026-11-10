import { createFileRoute } from "@tanstack/react-router";
import { ImageIcon, Link2, Play, Plus, X, ZoomIn, ZoomOut } from "lucide-react";
import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { toast } from "sonner";

import { useT } from "@/lib/i18n/context";
import { formatLocaleTime } from "@/lib/i18n/format";
import { useLocale } from "@/lib/i18n/context";
import { Loading } from "@/components/nowmode/Loading";
import { Pill, ScreenHeader } from "@/components/nowmode/ScreenHeader";
import { useUI } from "@/components/nowmode/ui-context";
import { DEFAULT_QUIET_START, effectiveBoardReviewTime } from "@/lib/nowmode/settings";
import { useNowMode } from "@/lib/nowmode/store";
import type { BoardCard } from "@/lib/nowmode/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/board")({
  head: () => ({
    meta: [
      { title: "Board · Now Mode" },
      { name: "description", content: "An investigation pin board for ideas — drag cards and connect them with red string." },
      { property: "og:title", content: "Board · Now Mode" },
      { property: "og:description", content: "An investigation pin board for ideas — drag cards and connect them with red string." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BoardScreen,
});

const CARD_W = 130;

interface Drag {
  id: string;
  offX: number;
  offY: number;
  x: number;
  y: number;
  startX: number;
  startY: number;
  moved: boolean;
}

function BoardScreen() {
  const t = useT();
  const { ready, state, moveCard, removeCard, addLink, removeLink } = useNowMode();
  const { openSheet, openCardSchedule } = useUI();
  const locale = useLocale();
  const canvasRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [mode, setMode] = useState<null | "add" | "remove">(null);
  const [pending, setPending] = useState<string | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [scale, setScale] = useState(1);

  if (!ready) return <Loading />;

  const pos = (c: BoardCard) => (drag?.id === c.id ? { x: drag.x, y: drag.y } : { x: c.x, y: c.y });
  const byId = new Map(state.cards.map((c) => [c.id, c]));
  const height = Math.max(560, ...state.cards.map((c) => pos(c).y + 180));

  const local = (e: ReactPointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: (e.clientX - rect.left) / scale, y: (e.clientY - rect.top) / scale };
  };

  const onDown = (e: ReactPointerEvent<HTMLDivElement>, c: BoardCard) => {
    if (mode) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = local(e);
    setDrag({ id: c.id, offX: p.x - c.x, offY: p.y - c.y, x: c.x, y: c.y, startX: p.x, startY: p.y, moved: false });
  };
  const onMove = (e: ReactPointerEvent) => {
    if (!drag) return;
    const p = local(e);
    const width = (canvasRef.current?.clientWidth ?? 340) - CARD_W;
    const moved = drag.moved || Math.hypot(p.x - drag.startX, p.y - drag.startY) > 4;
    setDrag({
      ...drag,
      moved,
      x: Math.round(Math.min(Math.max(0, p.x - drag.offX), Math.max(0, width))),
      y: Math.round(Math.max(12, p.y - drag.offY)),
    });
  };
  const onUp = () => {
    if (!drag) return;
    if (drag.moved) moveCard(drag.id, drag.x, drag.y);
    else setSelected((s) => (s === drag.id ? null : drag.id));
    setDrag(null);
  };

  const linkBetween = (a: string, b: string) =>
    state.links.find((link) => (link.from === a && link.to === b) || (link.from === b && link.to === a));

  const tapPin = (id: string) => {
    if (!mode) return;
    if (!pending) {
      setPending(id);
      return;
    }
    if (pending === id) {
      setPending(null);
      return;
    }
    if (mode === "remove") {
      const link = linkBetween(pending, id);
      if (link) {
        removeLink(link.id);
        toast(t("board.stringRemoved"));
      }
      setPending(null);
      return;
    }
    const ok = addLink(pending, id);
    toast(ok ? t("board.connected") : t("board.already"), { description: ok ? t("board.tied") : undefined });
    setPending(null);
  };

  const exitMode = () => {
    setMode(null);
    setPending(null);
  };

  return (
    <div className="flex h-full flex-col">
      <ScreenHeader title={t("nav.board")} right={<Pill>{t("board.hint")}</Pill>} />

      <div className="relative mx-5 min-h-0 flex-1 overflow-hidden rounded-[20px] border border-border2 bg-cork shadow-card">
        <div className="cork-grain pointer-events-none absolute inset-0" />
        {mode && (
          <div className="absolute inset-x-3 top-2 z-30 flex items-center justify-between gap-2 rounded-full bg-ink/80 px-3 py-1 text-[11px] font-semibold text-foreground">
            <span>{mode === "remove" ? t("board.removeMode") : pending ? t("board.second") : t("board.start")}</span>
            <button type="button" onClick={exitMode} className="underline">
              {t("board.cancelMode")}
            </button>
          </div>
        )}
        <div className="no-scrollbar h-full overflow-auto">
          <div
            ref={canvasRef}
            className="relative origin-top-left"
            style={{ height, width: `${100 / scale}%`, transform: `scale(${scale})` }}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
            onClick={(e) => {
              if (e.target === e.currentTarget) setSelected(null);
            }}
          >
            {/* Cards */}
            {state.cards.map((c) => {
              const p = pos(c);
              return (
                <div
                  key={c.id}
                  onPointerDown={(e) => onDown(e, c)}
                  className={cn(
                    "absolute touch-none select-none rounded-xl border bg-card2 px-3 pb-3 pt-4 shadow-card",
                    drag?.id === c.id ? "z-[5] cursor-grabbing border-blue/60" : "cursor-grab border-border2",
                    selected === c.id && "border-blue/70",
                  )}
                  style={{ left: p.x, top: p.y, width: CARD_W }}
                >
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-dim">
                    {t(c.kind === "voice" ? "board.kind.voice" : c.kind === "photo" ? "board.kind.photo" : "board.kind.text")}
                  </p>
                  {c.kind === "photo" &&
                    (c.image ? (
                      <img src={c.image} alt={c.text} draggable={false} className="mt-1.5 h-16 w-full rounded-md object-cover" />
                    ) : (
                      <div className="mt-1.5 grid h-10 place-items-center rounded-md bg-background/50 text-dim">
                        <ImageIcon className="size-4" />
                      </div>
                    ))}
                  <p
                    className={cn(
                      "mt-1 line-clamp-3 text-[12.5px] leading-snug",
                      c.kind === "voice" ? "text-green" : "text-foreground/90",
                    )}
                  >
                    {c.kind === "voice" && <Play className="mr-1 inline size-3 fill-current align-[-1px]" />}
                    {c.text}
                  </p>
                  {selected === c.id && !drag && (
                    <button
                      type="button"
                      aria-label={t("board.removeCard")}
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={() => {
                        removeCard(c.id);
                        setSelected(null);
                        toast(t("board.removed"));
                      }}
                      className="absolute -right-2 -top-2 grid size-6 place-items-center rounded-full border border-border2 bg-background text-muted-foreground"
                    >
                      <X className="size-3" />
                    </button>
                  )}
                </div>
              );
            })}

            {/* Red strings */}
            <svg className="pointer-events-none absolute inset-0 z-10 h-full w-full overflow-visible">
              {state.links.map((l) => {
                const a = byId.get(l.from);
                const b = byId.get(l.to);
                if (!a || !b) return null;
                const pa = pos(a);
                const pb = pos(b);
                const x1 = pa.x + CARD_W / 2;
                const y1 = pa.y;
                const x2 = pb.x + CARD_W / 2;
                const y2 = pb.y;
                const sag = Math.min(50, Math.hypot(x2 - x1, y2 - y1) * 0.18);
                const d = `M ${x1} ${y1} Q ${(x1 + x2) / 2} ${(y1 + y2) / 2 + sag} ${x2} ${y2}`;
                return (
                  <g key={l.id}>
                    <path d={d} fill="none" strokeWidth={2.5} strokeLinecap="round" className="stroke-string" />
                    <path
                      d={d}
                      fill="none"
                      strokeWidth={16}
                      stroke="transparent"
                      className={cn(mode !== "add" && "cursor-pointer")}
                      style={{ pointerEvents: mode === "add" ? "none" : "stroke" }}
                      onClick={() => {
                        removeLink(l.id);
                        toast(t("board.stringRemoved"), {
                          action: { label: t("board.undo"), onClick: () => addLink(l.from, l.to) },
                        });
                      }}
                    >
                      <title>{t("board.removeString")}</title>
                    </path>
                  </g>
                );
              })}
            </svg>

            {/* Pins */}
            {state.cards.map((c) => {
              const p = pos(c);
              const isPending = pending === c.id;
              return (
                <button
                  key={`pin-${c.id}`}
                  type="button"
                  aria-label={t("board.pin", { text: c.text })}
                  onClick={() => tapPin(c.id)}
                  className="absolute z-20 grid size-7 -translate-x-1/2 -translate-y-1/2 place-items-center"
                  style={{ left: p.x + CARD_W / 2, top: p.y }}
                >
                  <span
                    className={cn(
                      "block size-3.5 rounded-full bg-string shadow-[inset_-2px_-2px_0_oklch(0_0_0/0.25)] ring-1 ring-ink/40 transition-transform",
                      mode === "add" && "scale-110",
                      isPending && "scale-150 ring-2 ring-cream",
                    )}
                  />
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2.5 px-5 py-3">
        <button
          type="button"
          onClick={() => openSheet("board")}
          className="inline-flex h-11 items-center justify-center gap-1.5 rounded-xl border border-blue/70 bg-blue/10 text-sm font-semibold text-blue"
        >
          <Plus className="size-4" /> {t("board.card")}
        </button>
        <button
          type="button"
          aria-pressed={mode != null}
          onClick={() => {
            setPending(null);
            setMode((current) => (current === "add" ? "remove" : "add"));
          }}
          className={cn(
            "inline-flex h-11 items-center justify-center gap-1.5 rounded-xl border px-2 text-sm font-semibold transition-colors",
            mode ? "border-string/70 bg-string/15 text-foreground" : "border-border2 bg-card text-foreground",
          )}
        >
          <Link2 className="size-4 shrink-0" /> {mode === "add" ? t("board.disconnect") : t("board.connect")}
        </button>
        <button
          type="button"
          onClick={() => setScale((s) => (s === 1 ? 0.75 : 1))}
          className="inline-flex h-11 items-center justify-center gap-1.5 rounded-xl border border-border2 bg-card text-sm font-semibold"
        >
          {scale === 1 ? <ZoomOut className="size-4" /> : <ZoomIn className="size-4" />} {t("board.zoom")}
        </button>
      </div>
      <div className="flex gap-2 px-5 pb-3">
        {selected && (
          <button
            type="button"
            onClick={() => {
              const card = state.cards.find((item) => item.id === selected);
              if (card) openCardSchedule(card.text, card.id);
            }}
            className="h-10 flex-1 rounded-xl border border-border2 bg-card text-xs font-semibold"
          >
            {t("capture.scheduleCard")}
          </button>
        )}
        <button type="button" onClick={() => setReviewOpen(true)} className="h-10 flex-1 rounded-xl border border-border2 bg-card text-xs font-semibold">
          {t("board.review")}
        </button>
      </div>
      {reviewOpen && <ReviewSheet onClose={() => setReviewOpen(false)} />}
    </div>
  );
}

function ReviewSheet({ onClose }: { onClose: () => void }) {
  const t = useT();
  const locale = useLocale();
  const { state, setPrefs } = useNowMode();
  const anchor = state.prefs.quietStart ?? DEFAULT_QUIET_START;
  const effective = effectiveBoardReviewTime(state.prefs);
  return (
    <div className="absolute inset-0 z-30" role="dialog" aria-modal="true" aria-labelledby="review-title">
      <button type="button" aria-label={t("common.cancel")} className="absolute inset-0 bg-ink/70" onClick={onClose} />
      <div className="absolute inset-x-0 bottom-0 space-y-3 rounded-t-3xl border-x border-t border-border2 bg-bg2 px-5 pb-6 pt-4">
        <h2 id="review-title" className="text-lg font-bold">{t("board.reviewTitle")}</h2>
        <p className="text-sm text-muted-foreground">{t("board.reviewBody")}</p>
        <label className="flex items-center justify-between gap-3 text-sm font-semibold">
          {t("board.reviewOn")}
          <input
            type="checkbox"
            checked={!!state.prefs.boardReviewOn}
            onChange={(e) => setPrefs({ boardReviewOn: e.target.checked })}
            className="size-5"
          />
        </label>
        <label className="block text-xs font-semibold">
          {t("board.reviewTime")}
          <input
            type="time"
            value={effective}
            onChange={(e) => setPrefs({ boardReviewManual: true, boardReviewTime: e.target.value })}
            className="mt-1 h-11 w-full rounded-xl border border-border2 bg-card px-3 text-sm"
          />
        </label>
        <button type="button" className="text-xs font-semibold text-blue" onClick={() => setPrefs({ boardReviewManual: false, boardReviewTime: undefined })}>
          {t("board.reviewDefault", { time: formatLocaleTime(effectiveBoardReviewTime({ quietStart: anchor }), locale) })}
        </button>
        <p className="text-[11px] leading-relaxed text-dim">{t("board.reviewLimit")}</p>
        <button type="button" onClick={onClose} className="h-11 w-full rounded-xl bg-primary text-sm font-semibold text-primary-foreground">
          {t("common.close")}
        </button>
      </div>
    </div>
  );
}