import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { useT } from "@/lib/i18n/context";
import { clampZoom, pinchZoom, pointerDistance, wrapIndex, type ViewImage } from "@/lib/nowmode/viewer";

/** Full-screen photo. Pinch, wheel, or the buttons zoom. Swipe or the arrows move between photos. */
export function ImageViewer({
  images,
  index,
  onIndex,
  onClose,
}: {
  images: ViewImage[];
  index: number;
  onIndex: (next: number) => void;
  onClose: () => void;
}) {
  const t = useT();
  const image = images[index];
  const [scale, setScale] = useState(1);
  const [origin, setOrigin] = useState({ x: 0, y: 0 });
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ distance: number; scale: number } | null>(null);
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const moved = useRef(false);

  useEffect(() => {
    setScale(1);
    setOrigin({ x: 0, y: 0 });
  }, [index]);

  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const indexRef = useRef(index);
  indexRef.current = index;
  const countRef = useRef(images.length);
  countRef.current = images.length;
  const moveRef = useRef(onIndex);
  moveRef.current = onIndex;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeRef.current();
      if (event.key === "ArrowRight") moveRef.current(wrapIndex(indexRef.current, 1, countRef.current));
      if (event.key === "ArrowLeft") moveRef.current(wrapIndex(indexRef.current, -1, countRef.current));
    };
    window.addEventListener("keydown", onKey);
    window.history.pushState({ nowmodeViewer: true }, "");
    const onPop = () => closeRef.current();
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("popstate", onPop);
      if (window.history.state?.nowmodeViewer) window.history.back();
    };
  }, []);

  if (!image) return null;

  const close = () => {
    onClose();
  };

  const onPointerDown = (event: React.PointerEvent) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    moved.current = false;
    const pts = [...pointers.current.values()];
    if (pts.length === 2) {
      pinch.current = { distance: pointerDistance(pts[0], pts[1]), scale };
      drag.current = null;
    } else if (pts.length === 1) {
      drag.current = { x: event.clientX, y: event.clientY, ox: origin.x, oy: origin.y };
    }
  };

  const onPointerMove = (event: React.PointerEvent) => {
    if (!pointers.current.has(event.pointerId)) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const pts = [...pointers.current.values()];
    if (pts.length >= 2 && pinch.current) {
      moved.current = true;
      setScale(pinchZoom(pinch.current.distance, pointerDistance(pts[0], pts[1]), pinch.current.scale));
      return;
    }
    if (drag.current && scale > 1) {
      const dx = event.clientX - drag.current.x;
      const dy = event.clientY - drag.current.y;
      if (Math.hypot(dx, dy) > 4) moved.current = true;
      setOrigin({ x: drag.current.ox + dx, y: drag.current.oy + dy });
    }
  };

  const onPointerUp = (event: React.PointerEvent) => {
    const start = drag.current;
    pointers.current.delete(event.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    if (pointers.current.size === 0) drag.current = null;
    if (!start || scale > 1 || moved.current) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) && images.length > 1) {
      onIndex(wrapIndex(index, dx < 0 ? 1 : -1, images.length));
      return;
    }
    if (Math.hypot(dx, dy) < 8) close();
  };

  return (
    <div className="absolute inset-0 z-50 flex flex-col bg-ink text-foreground" role="dialog" aria-modal="true" aria-label={t("viewer.title")}>
      <div className="flex items-center justify-between px-3 py-3">
        <button type="button" aria-label={t("viewer.close")} onClick={close} className="grid size-10 place-items-center rounded-full bg-card text-foreground">
          <X className="size-5" />
        </button>
        <div className="flex gap-2">
          <button type="button" aria-label={t("viewer.zoomOut")} onClick={() => setScale((value) => clampZoom(value - 0.5))} className="grid size-10 place-items-center rounded-full bg-card">−</button>
          <button type="button" aria-label={t("viewer.zoomIn")} onClick={() => setScale((value) => clampZoom(value + 0.5))} className="grid size-10 place-items-center rounded-full bg-card">+</button>
        </div>
      </div>
      <div
        className="relative min-h-0 flex-1 touch-none overflow-hidden"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={(event) => {
          event.preventDefault();
          setScale((value) => clampZoom(value + (event.deltaY < 0 ? 0.2 : -0.2)));
        }}
      >
        <img
          src={image.src}
          alt={image.alt}
          draggable={false}
          className="absolute left-1/2 top-1/2 max-h-full max-w-full -translate-x-1/2 -translate-y-1/2 select-none object-contain"
          style={{ transform: `translate(calc(-50% + ${origin.x}px), calc(-50% + ${origin.y}px)) scale(${scale})` }}
        />
      </div>
      {images.length > 1 && (
        <div className="flex items-center justify-between px-3 py-3">
          <button type="button" aria-label={t("viewer.prev")} onClick={() => onIndex(wrapIndex(index, -1, images.length))} className="grid size-10 place-items-center rounded-full bg-card">
            <ChevronLeft className="size-5" />
          </button>
          <p className="text-xs text-muted-foreground">{t("viewer.count", { n: index + 1, total: images.length })}</p>
          <button type="button" aria-label={t("viewer.next")} onClick={() => onIndex(wrapIndex(index, 1, images.length))} className="grid size-10 place-items-center rounded-full bg-card">
            <ChevronRight className="size-5" />
          </button>
        </div>
      )}
    </div>
  );
}
