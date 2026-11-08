import { Camera, ChevronLeft, Mic, MicOff, Type, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { addDays, formatTime, nextHalfHour, parseCapture, toDateKey } from "@/lib/nowmode/logic";
import { useNowMode } from "@/lib/nowmode/store";
import { useUI, type SheetTab } from "./ui-context";

/* eslint-disable @typescript-eslint/no-explicit-any */
function getRecognition(): any | null {
  if (typeof window === "undefined") return null;
  const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  return SR ? new SR() : null;
}

/** Shrink a photo so it fits comfortably in localStorage. */
async function fileToSmallDataUrl(file: File, max = 640): Promise<string> {
  const raw = await new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = rej;
    r.readAsDataURL(file);
  });
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = raw;
    });
    const scale = Math.min(1, max / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext("2d")?.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.72);
  } catch {
    return raw;
  }
}

const options: { tab: SheetTab; label: string; hint: string; icon: typeof Type; tone: string }[] = [
  { tab: "text", label: "Text", hint: "“Call mom 3pm”", icon: Type, tone: "text-blue" },
  { tab: "voice", label: "Voice", hint: "Brain dump out loud", icon: Mic, tone: "text-teal" },
  { tab: "photo", label: "Photo", hint: "Snap sticky notes", icon: Camera, tone: "text-coral" },
];

export function AddSheet() {
  const { sheetOpen, sheetMode, sheetTab, setSheetTab, closeSheet } = useUI();

  useEffect(() => {
    if (!sheetOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeSheet();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sheetOpen, closeSheet]);

  if (!sheetOpen) return null;

  return (
    <div className="absolute inset-0 z-20" role="dialog" aria-modal="true" aria-label="Add">
      <button
        type="button"
        aria-label="Close"
        onClick={closeSheet}
        className="animate-fade-soft absolute inset-0 bg-ink/70 backdrop-blur-[2px]"
      />
      <div className="animate-sheet-up absolute inset-x-0 bottom-0 rounded-t-3xl border-x border-t border-border2 bg-bg2 px-5 pb-6 pt-3 shadow-shell">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-border2" />
        <div className="mb-4 flex items-center gap-2">
          {sheetTab !== "menu" && (
            <button
              type="button"
              aria-label="Back to options"
              onClick={() => setSheetTab("menu")}
              className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-card"
            >
              <ChevronLeft className="size-5" />
            </button>
          )}
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-bold">
              {sheetTab === "menu" ? (sheetMode === "board" ? "New board card" : "Get it out of your head") : options.find((o) => o.tab === sheetTab)?.label}
            </h2>
            {sheetTab === "menu" && (
              <p className="text-xs text-muted-foreground">Capture now, sort later. Nothing is lost.</p>
            )}
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={closeSheet}
            className="grid size-8 place-items-center rounded-lg text-dim hover:bg-card hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        {sheetTab === "menu" && (
          <div className="grid grid-cols-3 gap-3">
            {options.map(({ tab, label, hint, icon: Icon, tone }) => (
              <button
                key={tab}
                type="button"
                onClick={() => setSheetTab(tab)}
                className="flex flex-col items-center gap-2 rounded-2xl border border-border2 bg-card px-2 py-5 text-center transition-colors hover:bg-card2 active:scale-[0.98]"
              >
                <span className="grid size-11 place-items-center rounded-xl bg-background">
                  <Icon className={`size-5 ${tone}`} />
                </span>
                <span className="text-sm font-semibold">{label}</span>
                <span className="text-[11px] leading-tight text-dim">{hint}</span>
              </button>
            ))}
          </div>
        )}
        {sheetTab === "text" && <TextCapture />}
        {sheetTab === "voice" && <VoiceCapture />}
        {sheetTab === "photo" && <PhotoCapture />}
      </div>
    </div>
  );
}

function TextCapture() {
  const { addEvent, addCard } = useNowMode();
  const { sheetMode, closeSheet } = useUI();
  const [text, setText] = useState("");
  const parsed = useMemo(() => parseCapture(text), [text]);
  const boardOnly = sheetMode === "board";

  const save = () => {
    if (!text.trim()) return;
    if (boardOnly) {
      addCard({ kind: "text", text: text.trim() });
      toast("Pinned to Board");
    } else {
      const now = new Date();
      const time = parsed.time ?? nextHalfHour(now);
      addEvent({
        title: parsed.title,
        date: toDateKey(addDays(now, parsed.dayOffset)),
        time,
        duration: 20,
        tag: "Capture",
        color: "blue",
      });
      addCard({ kind: "text", text: text.trim() });
      toast("Captured", {
        description: `${parsed.dayOffset ? "Tomorrow" : "Today"} at ${formatTime(time)} · also pinned to Board`,
      });
    }
    closeSheet();
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
      className="space-y-3"
    >
      <textarea
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        placeholder={boardOnly ? "A thought, a clue, a maybe…" : "Call mom 3pm · Pay rent tomorrow 10am"}
        className="w-full resize-none rounded-2xl border border-border2 bg-card px-4 py-3 text-[15px] placeholder:text-dim focus:border-blue focus:outline-none"
      />
      {!boardOnly && text.trim() && (
        <p className="rounded-xl bg-card px-3 py-2 text-xs text-muted-foreground">
          → <span className="font-semibold text-foreground">{parsed.title}</span> ·{" "}
          {parsed.dayOffset ? "Tomorrow" : "Today"} ·{" "}
          <span className="text-blue">{parsed.time ? formatTime(parsed.time) : "next free half-hour"}</span>
        </p>
      )}
      <Button type="submit" size="lg" className="h-12 w-full rounded-xl text-[15px] font-semibold" disabled={!text.trim()}>
        {boardOnly ? "Pin to Board" : "Add to Today + Board"}
      </Button>
    </form>
  );
}

function VoiceCapture() {
  const { addCard } = useNowMode();
  const { closeSheet } = useUI();
  const recRef = useRef<any>(null);
  const [supported, setSupported] = useState<boolean | null>(null);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");

  useEffect(() => {
    setSupported(!!getRecognition());
    return () => recRef.current?.stop?.();
  }, []);

  const start = () => {
    const rec = getRecognition();
    if (!rec) return;
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = navigator.language || "en-US";
    rec.onresult = (e: any) => {
      let out = "";
      for (let i = 0; i < e.results.length; i++) out += e.results[i][0].transcript;
      setTranscript(out);
    };
    rec.onerror = () => {
      setListening(false);
      toast("Mic paused", { description: "We couldn't hear that — try again or type it." });
    };
    rec.onend = () => setListening(false);
    recRef.current = rec;
    rec.start();
    setListening(true);
  };

  const stop = () => {
    recRef.current?.stop();
    setListening(false);
  };

  const save = (demo = false) => {
    addCard({ kind: "voice", text: demo ? "0:30 demo brain dump" : transcript.trim() || "Voice note" });
    toast("Voice card pinned to Board");
    closeSheet();
  };

  if (supported === false) {
    return (
      <div className="space-y-3">
        <p className="rounded-2xl border border-border2 bg-card px-4 py-4 text-sm text-muted-foreground">
          Voice capture isn't available in this browser. You can still pin a demo voice card to see how it works.
        </p>
        <Button size="lg" className="h-12 w-full rounded-xl" onClick={() => save(true)}>
          Add demo voice card
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex min-h-24 items-start gap-3 rounded-2xl border border-border2 bg-card px-4 py-3">
        <span className={`mt-1 size-2.5 shrink-0 rounded-full ${listening ? "animate-breathe bg-teal" : "bg-dim"}`} />
        <p className="text-sm text-muted-foreground">
          {transcript || (listening ? "Listening… say it messy, that's fine." : "Tap the mic and talk it out.")}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Button
          variant="secondary"
          size="lg"
          className="h-12 rounded-xl"
          onClick={listening ? stop : start}
        >
          {listening ? <MicOff /> : <Mic />} {listening ? "Stop" : "Start mic"}
        </Button>
        <Button size="lg" className="h-12 rounded-xl" disabled={!transcript.trim()} onClick={() => save()}>
          Pin to Board
        </Button>
      </div>
    </div>
  );
}

function PhotoCapture() {
  const { addCard } = useNowMode();
  const { closeSheet } = useUI();
  const [image, setImage] = useState<string | null>(null);
  const [caption, setCaption] = useState("");

  const save = () => {
    if (!image) return;
    // TODO: OCR / AI parsing — extract text & dates from the photo and suggest Today events.
    addCard({ kind: "photo", text: caption.trim() || "Photo capture", image });
    toast("Photo pinned to Board");
    closeSheet();
  };

  return (
    <div className="space-y-3">
      <label className="flex cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-2xl border border-dashed border-border2 bg-card px-4 py-6 text-center hover:bg-card2">
        {image ? (
          <img src={image} alt="Selected capture" className="max-h-40 rounded-xl object-contain" />
        ) : (
          <>
            <Camera className="size-6 text-coral" />
            <span className="text-sm font-semibold">Take or choose a photo</span>
            <span className="text-[11px] text-dim">Sticky notes, whiteboards, letters</span>
          </>
        )}
        <input
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (f) setImage(await fileToSmallDataUrl(f));
          }}
        />
      </label>
      <input
        value={caption}
        onChange={(e) => setCaption(e.target.value)}
        placeholder="Caption (optional)"
        className="h-11 w-full rounded-xl border border-border2 bg-card px-4 text-sm placeholder:text-dim focus:border-blue focus:outline-none"
      />
      <Button size="lg" className="h-12 w-full rounded-xl" disabled={!image} onClick={save}>
        Pin to Board
      </Button>
    </div>
  );
}