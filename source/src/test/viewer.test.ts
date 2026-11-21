import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { messages } from "@/lib/i18n/messages";
import type { BoardCard } from "@/lib/nowmode/types";
import { boardPhotos, clampZoom, pinchZoom, pointerDistance, wrapIndex } from "@/lib/nowmode/viewer";

function card(partial: Partial<BoardCard> & Pick<BoardCard, "id">): BoardCard {
  return { kind: "text", text: partial.id, x: 0, y: 0, ...partial };
}

describe("board image viewer", () => {
  it("lists only photos that have an image, in board order", () => {
    const photos = boardPhotos([
      card({ id: "note", kind: "text" }),
      card({ id: "empty", kind: "photo", text: "blank" }),
      card({ id: "a", kind: "photo", text: "list", image: "data:a" }),
      card({ id: "voice", kind: "voice" }),
      card({ id: "b", kind: "photo", text: "receipt", image: "data:b" }),
    ]);
    expect(photos.map((photo) => photo.id)).toEqual(["a", "b"]);
    expect(photos[1].alt).toBe("receipt");
  });

  it("wraps between photos and clamps a pinch", () => {
    expect(wrapIndex(0, -1, 3)).toBe(2);
    expect(wrapIndex(2, 1, 3)).toBe(0);
    expect(pinchZoom(100, 200, 1)).toBe(2);
    expect(pinchZoom(100, 800, 1)).toBe(4);
    expect(pinchZoom(0, 10, 1)).toBe(1);
    expect(clampZoom(0.2)).toBe(1);
    expect(pointerDistance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  });

  it("has viewer words in both Spanish variants", () => {
    for (const key of ["viewer.close", "viewer.zoomIn", "viewer.next"] as const) {
      expect(messages["es-419"][key]).toBeTruthy();
      expect(messages["es-ES"][key]).toBeTruthy();
      expect(messages["es-419"][key]).not.toBe(messages["es-ES"][key]);
    }
  });
});

describe("Now activity screen", () => {
  const source = readFileSync(path.join(process.cwd(), "src/routes/index.tsx"), "utf8");
  const activity = source.slice(source.indexOf("function UpNext"), source.indexOf("function GhostBtn"));

  it("drops the until line and the capture paragraph from the activity", () => {
    expect(activity).not.toContain("today.until");
    expect(activity).not.toContain("today.ended");
    expect(activity).not.toContain("today.ofMin");
    expect(activity).not.toContain("duration.none");
    expect(activity).not.toContain("energyCopy");
    expect(source.slice(source.indexOf("function AllClearCard"), source.indexOf("function UpNext"))).not.toContain("today.clearBody");
    expect(source).toContain("today.capture");
  });
});
