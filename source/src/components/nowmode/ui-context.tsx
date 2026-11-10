import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

export type SheetMode = "all" | "board";
export type SheetTab = "menu" | "text" | "voice" | "photo";
export type TimerRequest = { kind: "block" | "free"; eventId: string; minutes?: number } | null;

interface UIState {
  drawerOpen: boolean;
  setDrawerOpen: (v: boolean) => void;
  sheetOpen: boolean;
  sheetMode: SheetMode;
  sheetTab: SheetTab;
  setSheetTab: (t: SheetTab) => void;
  openSheet: (mode?: SheetMode, tab?: SheetTab) => void;
  closeSheet: () => void;
  scheduleEventId: string | null;
  openSchedule: (id: string) => void;
  closeSchedule: () => void;
  timerRequest: TimerRequest;
  askTimer: (req: Exclude<TimerRequest, null>) => void;
  closeTimerRequest: () => void;
  stepsEventId: string | null;
  openSteps: (id: string) => void;
  closeSteps: () => void;
  captureDraft: { text: string; cardId: string } | null;
  openCardSchedule: (text: string, cardId: string) => void;
}

const UICtx = createContext<UIState | null>(null);

export function UIProvider({ children }: { children: ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetMode, setSheetMode] = useState<SheetMode>("all");
  const [sheetTab, setSheetTab] = useState<SheetTab>("menu");
  const [scheduleEventId, setScheduleEventId] = useState<string | null>(null);
  const [timerRequest, setTimerRequest] = useState<TimerRequest>(null);
  const [stepsEventId, setStepsEventId] = useState<string | null>(null);
  const [captureDraft, setCaptureDraft] = useState<{ text: string; cardId: string } | null>(null);

  const value = useMemo<UIState>(
    () => ({
      drawerOpen,
      setDrawerOpen,
      sheetOpen,
      sheetMode,
      sheetTab,
      setSheetTab,
      openSheet: (mode = "all", tab = "menu") => {
        setCaptureDraft(null);
        setSheetMode(mode);
        setSheetTab(tab);
        setSheetOpen(true);
      },
      closeSheet: () => {
        setCaptureDraft(null);
        setSheetOpen(false);
      },
      captureDraft,
      openCardSchedule: (text, cardId) => {
        setCaptureDraft({ text, cardId });
        setSheetMode("all");
        setSheetTab("text");
        setSheetOpen(true);
      },
      scheduleEventId,
      openSchedule: (id: string) => setScheduleEventId(id),
      closeSchedule: () => setScheduleEventId(null),
      timerRequest,
      askTimer: (req) => setTimerRequest(req),
      closeTimerRequest: () => setTimerRequest(null),
      stepsEventId,
      openSteps: (id: string) => setStepsEventId(id),
      closeSteps: () => setStepsEventId(null),
    }),
    [drawerOpen, sheetOpen, sheetMode, sheetTab, scheduleEventId, timerRequest, stepsEventId, captureDraft],
  );

  return <UICtx.Provider value={value}>{children}</UICtx.Provider>;
}

export function useUI(): UIState {
  const v = useContext(UICtx);
  if (!v) throw new Error("useUI must be used inside UIProvider");
  return v;
}