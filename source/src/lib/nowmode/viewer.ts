import type { BoardCard } from "./types";

export interface ViewImage {
  id: string;
  src: string;
  alt: string;
}

export const MIN_ZOOM = 1;
export const MAX_ZOOM = 4;

/** Photos pinned on the board, in board order. Empty cards are skipped. */
export function boardPhotos(cards: BoardCard[]): ViewImage[] {
  return cards.flatMap((card) =>
    card.kind === "photo" && card.image ? [{ id: card.id, src: card.image, alt: card.text || "" }] : [],
  );
}

export function wrapIndex(index: number, delta: number, count: number): number {
  if (count <= 0) return 0;
  return (index + delta + count * 8) % count;
}

export function clampZoom(scale: number): number {
  if (!Number.isFinite(scale)) return MIN_ZOOM;
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, scale));
}

export function pinchZoom(startDistance: number, distance: number, startScale: number): number {
  if (startDistance <= 0) return clampZoom(startScale);
  return clampZoom(startScale * (distance / startDistance));
}

export function pointerDistance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
