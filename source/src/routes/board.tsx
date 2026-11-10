import { createFileRoute } from "@tanstack/react-router";
import { ImageIcon, Play, Plus, X, ZoomIn, ZoomOut } from "lucide-react";
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
      { name: "description", content: "A pin board for ideas. Drag notes around and schedule the ones you want." },
      { property: "og:title", content: "Board · Now Mode" },
      { property: "og:description", content: "A pin board for ideas. Drag notes around and schedule the ones you want." },
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
  const { ready, state, moveCard, removeCard } = useNowMode();
  const { openSheet, openCardSchedule } = useUI();
  const locale = useLocale();
  const canvasRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [scale, setScale] = useState(1);

  if (!ready) return <Loading />;

  const pos = (c: BoardCard) => (drag?.id === c.id ? { x: drag.x, y: drag.y } : { x: c.x, y: c.y });
  const height = Math.max(560, ...state.cards.map((c) => pos(c).y + 180));

  const local = (e: ReactPointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: (e.clientX - rect.left) / scale, y: (e.clientY - rect.top) / scale };
  };

  const onDown = (e: ReactPointerEvent<HTMLDivElement>, c: BoardCard) => {
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

  return (
    <div className="flex h-full flex-col">
      <ScreenHeader title={t("nav.board")} right={<Pill>{t("board.hint")}</Pill>} />

      <div data-tour="board" className="relative mx-5 min-h-0 flex-1 overflow-hidden rounded-[20px] border border-border2 bg-cork shadow-card">
        <div className="cork-grain pointer-events-none absolute inset-0" />
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

            {state.cards.map((c) => {
              const p = pos(c);
              return (
                <span
                  key={`pin-${c.id}`}
                  aria-hidden
                  className="pointer-events-none absolute z-20 grid size-7 -translate-x-1/2 -translate-y-1/2 place-items-center"
                  style={{ left: p.x + CARD_W / 2, top: p.y }}
                >
                  <span className="block size-3.5 rounded-full bg-string shadow-[inset_-2px_-2px_0_oklch(0_0_0/0.25)] ring-1 ring-ink/40" />
                </span>
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5 px-5 py-3">
        <button
          type="button"
          onClick={() => openSheet("board")}
          className="inline-flex h-11 items-center justify-center gap-1.5 rounded-xl border border-blue/70 bg-blue/10 text-sm font-semibold text-blue"
        >
          <Plus className="size-4" /> {t("board.card")}
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
        <button type="button" className="text-left text-xs font-semibold leading-relaxed text-blue whitespace-normal" onClick={() => setPrefs({ boardReviewManual: false, boardReviewTime: undefined })}>
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