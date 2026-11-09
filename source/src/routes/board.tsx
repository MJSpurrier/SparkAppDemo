import { createFileRoute } from "@tanstack/react-router";
import { ImageIcon, Link2, Play, Plus, X, ZoomIn, ZoomOut } from "lucide-react";
import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { toast } from "sonner";

import { useT } from "@/lib/i18n/context";
import { Loading } from "@/components/nowmode/Loading";
import { Pill, ScreenHeader } from "@/components/nowmode/ScreenHeader";
import { useUI } from "@/components/nowmode/ui-context";
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
  const { openSheet } = useUI();
  const canvasRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [connect, setConnect] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
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
    if (connect) return;
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

  const tapPin = (id: string) => {
    if (!connect) {
      setConnect(true);
      setPending(id);
      return;
    }
    if (!pending) {
      setPending(id);
      return;
    }
    if (pending === id) {
      setPending(null);
      return;
    }
    const ok = addLink(pending, id);
    toast(ok ? "Connected" : "Already connected", { description: ok ? "Red string tied." : undefined });
    setPending(null);
  };

  return (
    <div className="flex h-full flex-col">
      <ScreenHeader title={t("nav.board")} right={<Pill>{t("board.hint")}</Pill>} />

      <div className="relative mx-5 min-h-0 flex-1 overflow-hidden rounded-[20px] border border-border2 bg-cork shadow-card">
        <div className="cork-grain pointer-events-none absolute inset-0" />
        {connect && (
          <p className="absolute inset-x-0 top-2 z-30 mx-auto w-fit rounded-full bg-ink/80 px-3 py-1 text-[11px] font-semibold text-foreground">
            {pending ? "Now tap a second pin" : "Tap a pin to start a string"}
          </p>
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
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-dim">{c.kind}</p>
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
                      aria-label="Remove card"
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={() => {
                        removeCard(c.id);
                        setSelected(null);
                        toast("Card removed");
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
                      className={cn(!connect && "cursor-pointer")}
                      style={{ pointerEvents: connect ? "none" : "stroke" }}
                      onClick={() => {
                        removeLink(l.id);
                        toast("String removed", {
                          action: { label: "Undo", onClick: () => addLink(l.from, l.to) },
                        });
                      }}
                    >
                      <title>Tap to remove string</title>
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
                  aria-label={`Pin on ${c.text}`}
                  onClick={() => tapPin(c.id)}
                  className="absolute z-20 grid size-7 -translate-x-1/2 -translate-y-1/2 place-items-center"
                  style={{ left: p.x + CARD_W / 2, top: p.y }}
                >
                  <span
                    className={cn(
                      "block size-3.5 rounded-full bg-string shadow-[inset_-2px_-2px_0_oklch(0_0_0/0.25)] ring-1 ring-ink/40 transition-transform",
                      connect && "scale-110",
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
          <Plus className="size-4" /> Card
        </button>
        <button
          type="button"
          aria-pressed={connect}
          onClick={() => {
            setConnect((v) => !v);
            setPending(null);
          }}
          className={cn(
            "inline-flex h-11 items-center justify-center gap-1.5 rounded-xl border text-sm font-semibold transition-colors",
            connect ? "border-string/70 bg-string/15 text-foreground" : "border-border2 bg-card text-foreground",
          )}
        >
          <Link2 className="size-4" /> {connect ? "Done" : "Connect"}
        </button>
        <button
          type="button"
          onClick={() => setScale((s) => (s === 1 ? 0.75 : 1))}
          className="inline-flex h-11 items-center justify-center gap-1.5 rounded-xl border border-border2 bg-card text-sm font-semibold"
        >
          {scale === 1 ? <ZoomOut className="size-4" /> : <ZoomIn className="size-4" />} Zoom
        </button>
      </div>
    </div>
  );
}