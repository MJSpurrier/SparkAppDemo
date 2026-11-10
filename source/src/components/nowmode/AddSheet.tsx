import { Camera, ChevronLeft, Mic, MicOff, Type, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { useT } from "@/lib/i18n/context";
import { formatLocaleTime } from "@/lib/i18n/format";
import { useLocale } from "@/lib/i18n/context";
import { explainScheduleError } from "@/lib/i18n/context";
import { Button } from "@/components/ui/button";
import { addDays, nextHalfHour, parseCapture, toDateKey } from "@/lib/nowmode/logic";
import { parseMinutesInput, validateSlot } from "@/lib/nowmode/schedule";
import { useNowMode } from "@/lib/nowmode/store";
import type { ScheduleType } from "@/lib/nowmode/types";
import { dateKey } from "@/lib/nowmode/recurrence";
import { recurrenceReady, ruleFromDraft } from "@/lib/nowmode/recurrence";
import { RecurrenceEditor, type RecurrenceDraft } from "./RecurrenceEditor";
import { ScheduleTypeField } from "./ScheduleTypeField";
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

const options = [
  { tab: "text" as const, label: "capture.text" as const, hint: "capture.textHint" as const, icon: Type, tone: "text-blue" },
  { tab: "voice" as const, label: "capture.voice" as const, hint: "capture.voiceHint" as const, icon: Mic, tone: "text-teal" },
  { tab: "photo" as const, label: "capture.photo" as const, hint: "capture.photoHint" as const, icon: Camera, tone: "text-coral" },
];

export function AddSheet() {
  const t = useT();
  const { sheetOpen, sheetMode, sheetTab, setSheetTab, closeSheet } = useUI();

  useEffect(() => {
    if (!sheetOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeSheet();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sheetOpen, closeSheet]);

  if (!sheetOpen) return null;

  return (
    <div className="absolute inset-0 z-20" role="dialog" aria-modal="true" aria-label={t("capture.addAria")}>
      <button
        type="button"
        aria-label={t("common.close")}
        onClick={closeSheet}
        className="animate-fade-soft absolute inset-0 bg-ink/70 backdrop-blur-[2px]"
      />
      <div className="animate-sheet-up absolute inset-x-0 bottom-0 rounded-t-3xl border-x border-t border-border2 bg-bg2 px-5 pb-6 pt-3 shadow-shell">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-border2" />
        <div className="mb-4 flex items-center gap-2">
          {sheetTab !== "menu" && (
            <button
              type="button"
              aria-label={t("capture.back")}
              onClick={() => setSheetTab("menu")}
              className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-card"
            >
              <ChevronLeft className="size-5" />
            </button>
          )}
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-bold">
              {sheetTab === "menu"
                ? sheetMode === "board"
                  ? t("capture.boardHead")
                  : t("capture.head")
                : t(options.find((o) => o.tab === sheetTab)?.label ?? "capture.text")}
            </h2>
            {sheetTab === "menu" && (
              <p className="text-xs text-muted-foreground">{t("capture.sub")}</p>
            )}
          </div>
          <button
            type="button"
            aria-label={t("common.close")}
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
                <span className="text-sm font-semibold">{t(label)}</span>
                <span className="text-[11px] leading-tight text-dim">{t(hint)}</span>
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
  const t = useT();
  const locale = useLocale();
  const { addEvent, addCard, addSeries, cardAlreadyPlanned } = useNowMode();
  const { sheetMode, closeSheet, captureDraft } = useUI();
  const [text, setText] = useState(captureDraft?.text ?? "");
  const [schedule, setSchedule] = useState<ScheduleType>("flexible");
  const [minutes, setMinutes] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [step, setStep] = useState<"date" | "time">("date");
  const [recurring, setRecurring] = useState(false);
  const [draft, setDraft] = useState<RecurrenceDraft>({ freq: "weekly", weekdays: [], monthDays: [], customBy: "weekdays", end: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const parsed = useMemo(() => parseCapture(text), [text]);
  const boardOnly = sheetMode === "board" && !captureDraft;

  const place = (kind: "today" | "schedule" | "board") => {
    if (busy || !text.trim()) return;
    setBusy(true);
    try {
      if (kind === "board") {
        addCard({ kind: "text", text: text.trim() });
        toast(t("capture.pinned"), { description: t("capture.boardOnly") });
        closeSheet();
        return;
      }
      if (captureDraft && cardAlreadyPlanned(captureDraft.cardId)) {
        toast(t("capture.dup"));
        closeSheet();
        return;
      }
      const length = parseMinutesInput(minutes);
      if (!length.ok) {
        setError(explainScheduleError(locale, length));
        return;
      }
      const now = new Date();
      const chosenTime = time || parsed.time || nextHalfHour(now);
      if (!time && kind === "today" && !parsed.time) setTime(chosenTime);
      if (!chosenTime) {
        setError(t("capture.needTime"));
        return;
      }
      const chosenDate = kind === "today" ? toDateKey(now) : date;
      if (kind === "schedule" && !date) {
        setError(t("capture.needDate"));
        return;
      }
      const slot = validateSlot({ date: chosenDate, time: chosenTime, duration: length.minutes });
      if (!slot.ok) {
        setError(explainScheduleError(locale, slot));
        return;
      }
      const title = parsed.title || text.trim();
      if (recurring) {
        const rule = ruleFromDraft({
          freq: draft.freq,
          weekdays: draft.weekdays.length ? draft.weekdays : [new Date(`${chosenDate}T12:00:00`).getDay()],
          monthDays: draft.monthDays.length ? draft.monthDays : [Number(chosenDate.slice(8))],
          customBy: draft.customBy,
          start: chosenDate,
          end: draft.end || undefined,
          time: chosenTime,
          duration: length.minutes,
          schedule,
          title,
          tag: "Capture",
          color: "blue",
          nudges: { day: false, hour: true, ten: true, now: true },
          sourceCardId: captureDraft?.cardId,
        });
        if (!recurrenceReady(rule)) {
          setError(t("recur.needDay"));
          return;
        }
        addSeries(rule);
      } else {
        addEvent({
          title,
          date: chosenDate,
          time: chosenTime,
          duration: length.minutes,
          tag: "Capture",
          color: "blue",
          schedule,
          sourceCardId: captureDraft?.cardId,
        });
      }
      toast(t("capture.saved"), {
        description: t("capture.savedBody", {
          when: chosenDate === toDateKey(now) ? t("capture.today") : chosenDate,
          time: formatLocaleTime(chosenTime, locale),
          kind: t(schedule === "fixed" ? "badge.fixed" : "badge.flexible"),
        }),
      });
      closeSheet();
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        place(boardOnly ? "board" : "today");
      }}
      className="space-y-3"
    >
      <div className="max-h-[42vh] space-y-3 overflow-y-auto pr-1">
      <textarea
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        placeholder={boardOnly ? t("capture.boardPh") : t("capture.ph")}
        className="w-full resize-none rounded-2xl border border-border2 bg-card px-4 py-3 text-[15px] placeholder:text-dim focus:border-blue focus:outline-none"
      />
      {!boardOnly && (
        <>
          <ScheduleTypeField
            value={schedule}
            onChange={setSchedule}
            name="capture-schedule"
            extra={
              <button
                type="button"
                aria-pressed={recurring}
                onClick={() => {
                  setRecurring((on) => !on);
                  if (!draft.weekdays.length) {
                    const seed = date || dateKey(new Date());
                    setDraft((current) => ({ ...current, weekdays: [new Date(`${seed}T12:00:00`).getDay()], monthDays: [Number(seed.slice(8))] }));
                  }
                }}
                className={`rounded-xl border px-2 py-2.5 text-center text-sm font-semibold ${recurring ? "border-blue/60 bg-blue/15 text-blue" : "border-border2 bg-card text-muted-foreground"}`}
              >
                {t("recur.button")}
              </button>
            }
          />
          <label className="block text-xs font-semibold">
            {t("capture.length")}
            <span className="ml-1 font-normal text-dim">{t("duration.optional")}</span>
            <input
              inputMode="numeric"
              value={minutes}
              placeholder={t("duration.optional")}
              onChange={(e) => {
                setMinutes(e.target.value);
                setError(null);
              }}
              className="mt-1 h-11 w-full rounded-xl border border-border2 bg-card px-3 text-sm font-medium focus:border-blue focus:outline-none"
            />
          </label>
          <label className="block text-xs font-semibold">
            {t("capture.pickTime")}
            <input
              type="time"
              value={time}
              onChange={(e) => {
                setTime(e.target.value);
                setError(null);
              }}
              className="mt-1 h-11 w-full rounded-xl border border-border2 bg-card px-3 text-sm font-medium focus:border-blue focus:outline-none"
            />
          </label>
          <div className="space-y-2 rounded-2xl border border-border bg-card px-3 py-3">
            <p className="text-xs font-semibold">{t("capture.scheduleBtn")}</p>
            {step === "date" ? (
              <label className="block text-xs font-semibold">
                {t("capture.pickDate")}
                <input
                  type="date"
                  value={date}
                  onChange={(e) => {
                    setDate(e.target.value);
                    setError(null);
                    if (e.target.value) setStep("time");
                  }}
                  className="mt-1 h-11 w-full rounded-xl border border-border2 bg-background px-3 text-sm"
                />
              </label>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">{date}</p>
                <label className="block text-xs font-semibold">
                  {t("capture.pickTime")}
                  <input
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className="mt-1 h-11 w-full rounded-xl border border-border2 bg-background px-3 text-sm"
                  />
                </label>
                <button type="button" className="text-xs font-semibold text-blue" onClick={() => setStep("date")}>
                  {t("capture.pickDate")}
                </button>
              </div>
            )}
          </div>
          {recurring && (
            <RecurrenceEditor
              value={draft}
              onChange={setDraft}
              startLabel={`${t("recur.start")}: ${date || dateKey(new Date())}`}
            />
          )}
        </>
      )}
      </div>
      {error && (
        <p role="alert" className="text-xs text-coral">
          {error}
        </p>
      )}
      <div className={boardOnly || captureDraft ? "grid grid-cols-1 gap-2" : "grid grid-cols-3 gap-2"}>
        {boardOnly ? (
          <Button type="submit" size="lg" className="h-12 rounded-xl whitespace-normal text-xs" disabled={!text.trim() || busy}>
            {t("capture.toBoard")}
          </Button>
        ) : (
          <>
            <Button type="button" size="lg" className="h-12 rounded-xl whitespace-normal px-2 text-xs" disabled={!text.trim() || busy} onClick={() => place("today")}>
              {t("capture.toToday")}
            </Button>
            <Button type="button" variant="secondary" size="lg" className="h-12 rounded-xl whitespace-normal px-2 text-xs" disabled={!text.trim() || busy || !date} onClick={() => place("schedule")}>
              {t("capture.scheduleBtn")}
            </Button>
            {!captureDraft && (
              <Button type="button" variant="secondary" size="lg" className="h-12 rounded-xl whitespace-normal px-2 text-xs" disabled={!text.trim() || busy} onClick={() => place("board")}>
                {t("capture.toBoard")}
              </Button>
            )}
          </>
        )}
      </div>
    </form>
  );
}

function VoiceCapture() {
  const t = useT();
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
      toast(t("capture.micPaused"), { description: t("capture.micBody") });
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
    addCard({ kind: "voice", text: demo ? t("capture.demoText") : transcript.trim() || t("capture.voiceNote") });
    toast(t("capture.voicePinned"));
    closeSheet();
  };

  if (supported === false) {
    return (
      <div className="space-y-3">
        <p className="rounded-2xl border border-border2 bg-card px-4 py-4 text-sm text-muted-foreground">
          {t("capture.voiceNo")}
        </p>
        <Button size="lg" className="h-12 w-full rounded-xl" onClick={() => save(true)}>
          {t("capture.demo")}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex min-h-24 items-start gap-3 rounded-2xl border border-border2 bg-card px-4 py-3">
        <span className={`mt-1 size-2.5 shrink-0 rounded-full ${listening ? "animate-breathe bg-teal" : "bg-dim"}`} />
        <p className="text-sm text-muted-foreground">
          {transcript || (listening ? t("capture.listen") : t("capture.talk"))}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Button
          variant="secondary"
          size="lg"
          className="h-12 rounded-xl"
          onClick={listening ? stop : start}
        >
          {listening ? <MicOff /> : <Mic />} {listening ? t("capture.stopMic") : t("capture.mic")}
        </Button>
        <Button size="lg" className="h-12 rounded-xl" disabled={!transcript.trim()} onClick={() => save()}>
          {t("capture.pin")}
        </Button>
      </div>
    </div>
  );
}

function PhotoCapture() {
  const t = useT();
  const { addCard } = useNowMode();
  const { closeSheet } = useUI();
  const [image, setImage] = useState<string | null>(null);
  const [caption, setCaption] = useState("");

  const save = () => {
    if (!image) return;
    // TODO: OCR / AI parsing — extract text & dates from the photo and suggest Today events.
    addCard({ kind: "photo", text: caption.trim() || t("capture.photoNote"), image });
    toast(t("capture.photoPinned"));
    closeSheet();
  };

  return (
    <div className="space-y-3">
      <label className="flex cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-2xl border border-dashed border-border2 bg-card px-4 py-6 text-center hover:bg-card2">
        {image ? (
          <img src={image} alt={t("capture.photoAlt")} className="max-h-40 rounded-xl object-contain" />
        ) : (
          <>
            <Camera className="size-6 text-coral" />
            <span className="text-sm font-semibold">{t("capture.photoBtn")}</span>
            <span className="text-[11px] text-dim">{t("capture.photoSub")}</span>
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
        placeholder={t("capture.caption")}
        className="h-11 w-full rounded-xl border border-border2 bg-card px-4 text-sm placeholder:text-dim focus:border-blue focus:outline-none"
      />
      <Button size="lg" className="h-12 w-full rounded-xl" disabled={!image} onClick={save}>
        {t("capture.pin")}
      </Button>
    </div>
  );
}