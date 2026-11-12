import { useState } from "react";
import { toast } from "sonner";

import { useT } from "@/lib/i18n/context";
import { cheerIndex, extendGoalDue, isDateKey, overdueGoals } from "@/lib/nowmode/goals";
import { toDateKey } from "@/lib/nowmode/logic";
import { useNowMode } from "@/lib/nowmode/store";

const CHEERS = ["goal.cheer1", "goal.cheer2", "goal.cheer3"] as const;

/** Shown once per open when a goal's day has arrived and it is still open. */
export function GoalPrompt() {
  const t = useT();
  const { ready, state, setGoalDone, rescheduleGoal } = useNowMode();
  const [later, setLater] = useState(false);
  const [picking, setPicking] = useState(false);
  const [date, setDate] = useState("");
  if (!ready || later) return null;
  const today = new Date();
  const goal = overdueGoals(state.goals ?? [], toDateKey(today))[0];
  if (!goal) return null;

  const move = (due: string) => {
    rescheduleGoal(goal.id, due);
    const cheer = CHEERS[cheerIndex(goal.id, due, CHEERS.length)] ?? "goal.cheer1";
    toast(t(cheer));
    setPicking(false);
  };

  return (
    <div className="absolute inset-0 z-[55] flex items-end bg-ink/70 p-4" role="dialog" aria-modal="true" aria-labelledby="goal-prompt-title">
      <div className="w-full space-y-3 rounded-2xl border border-border2 bg-card px-4 py-4 text-foreground">
        <h2 id="goal-prompt-title" className="text-base font-bold">{t("goal.promptTitle")}</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">{t("goal.promptBody", { title: goal.title })}</p>
        <button type="button" className="h-11 w-full rounded-xl bg-primary text-sm font-semibold text-primary-foreground" onClick={() => setGoalDone(goal.id, true)}>
          {t("goal.itsDone")}
        </button>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" className="h-11 rounded-xl border border-border2 text-sm font-semibold" onClick={() => move(extendGoalDue(today, "tomorrow"))}>
            {t("goal.tomorrow")}
          </button>
          <button type="button" className="h-11 rounded-xl border border-border2 text-sm font-semibold" onClick={() => move(extendGoalDue(today, "week"))}>
            {t("goal.week")}
          </button>
        </div>
        {picking ? (
          <form
            className="flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              if (!isDateKey(date) || date <= toDateKey(today)) return;
              move(date);
            }}
          >
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label={t("goal.pick")} className="h-11 min-w-0 flex-1 rounded-xl border border-border2 bg-background px-3 text-sm" />
            <button type="submit" className="h-11 rounded-xl bg-primary px-3 text-sm font-semibold text-primary-foreground">{t("goal.save")}</button>
          </form>
        ) : (
          <button type="button" className="h-11 w-full rounded-xl border border-border2 text-sm font-semibold" onClick={() => setPicking(true)}>
            {t("goal.pick")}
          </button>
        )}
        <button type="button" className="h-10 w-full text-sm font-semibold text-muted-foreground" onClick={() => setLater(true)}>
          {t("goal.later")}
        </button>
      </div>
    </div>
  );
}
