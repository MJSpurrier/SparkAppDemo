import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/context";
import { uid } from "@/lib/nowmode/logic";
import { useNowMode } from "@/lib/nowmode/store";
import type { Step } from "@/lib/nowmode/types";

import { useUI } from "./ui-context";

export function StepEditor() {
  const { stepsEventId, closeSteps } = useUI();
  const { state } = useNowMode();
  const ev = state.events.find((e) => e.id === stepsEventId);
  if (!stepsEventId || !ev) return null;
  return <StepForm key={ev.id + (ev.steps?.map((s) => s.id + s.title + s.done).join("|") ?? "")} eventId={ev.id} initial={ev.steps ?? []} title={ev.title} onClose={closeSteps} />;
}

function StepForm({
  eventId,
  initial,
  title,
  onClose,
}: {
  eventId: string;
  initial: Step[];
  title: string;
  onClose: () => void;
}) {
  const t = useT();
  const { setSteps } = useNowMode();
  const [rows, setRows] = useState<Step[]>(initial.length ? initial.map((s) => ({ ...s })) : [{ id: uid(), title: "", done: false }]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const save = () => {
    const cleaned = rows.map((r) => ({ ...r, title: r.title.trim() }));
    if (cleaned.some((r) => !r.title)) {
      setError(t("steps.empty"));
      return;
    }
    setSteps(eventId, cleaned);
    onClose();
  };

  return (
    <div className="absolute inset-0 z-30" role="dialog" aria-modal="true" aria-labelledby="steps-title">
      <button type="button" aria-label={t("common.cancel")} onClick={onClose} className="absolute inset-0 bg-ink/70" />
      <div className="animate-sheet-up absolute inset-x-0 bottom-0 max-h-[92%] overflow-y-auto rounded-t-3xl border-x border-t border-border2 bg-bg2 px-5 pb-6 pt-3 shadow-shell">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-border2" />
        <h2 id="steps-title" className="text-lg font-bold">
          {t("steps.title")}
        </h2>
        <p className="mt-1 text-sm font-semibold">{title}</p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{t("steps.help")}</p>
        <ol className="mt-4 space-y-2">
          {rows.map((row, index) => (
            <li key={row.id} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={row.done}
                aria-label={t("steps.label", { n: index + 1 })}
                onChange={() => setRows((list) => list.map((item) => (item.id === row.id ? { ...item, done: !item.done } : item)))}
                className="size-5 shrink-0 accent-[var(--blue)]"
              />
              <label className="sr-only" htmlFor={`step-${row.id}`}>
                {t("steps.label", { n: index + 1 })}
              </label>
              <input
                id={`step-${row.id}`}
                value={row.title}
                placeholder={t("steps.label", { n: index + 1 })}
                onChange={(e) => {
                  const title = e.target.value;
                  setRows((list) => list.map((item) => (item.id === row.id ? { ...item, title } : item)));
                  setError(null);
                }}
                className="h-11 min-w-0 flex-1 rounded-xl border border-border2 bg-card px-3 text-sm focus:border-blue focus:outline-none"
              />
              <button
                type="button"
                aria-label={t("steps.up", { n: index + 1 })}
                disabled={index === 0}
                onClick={() =>
                  setRows((list) => {
                    const next = [...list];
                    const [item] = next.splice(index, 1);
                    next.splice(index - 1, 0, item!);
                    return next;
                  })
                }
                className="grid size-11 place-items-center rounded-xl border border-border2 text-muted-foreground disabled:opacity-30"
              >
                <ChevronUp className="size-4" />
              </button>
              <button
                type="button"
                aria-label={t("steps.down", { n: index + 1 })}
                disabled={index === rows.length - 1}
                onClick={() =>
                  setRows((list) => {
                    const next = [...list];
                    const [item] = next.splice(index, 1);
                    next.splice(index + 1, 0, item!);
                    return next;
                  })
                }
                className="grid size-11 place-items-center rounded-xl border border-border2 text-muted-foreground disabled:opacity-30"
              >
                <ChevronDown className="size-4" />
              </button>
              <button
                type="button"
                aria-label={t("steps.remove", { n: index + 1 })}
                onClick={() => setRows((list) => list.filter((item) => item.id !== row.id))}
                className="grid size-11 place-items-center rounded-xl border border-border2 text-muted-foreground"
              >
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ol>
        <button
          type="button"
          onClick={() => setRows((list) => [...list, { id: uid(), title: "", done: false }])}
          className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border2 text-sm font-semibold text-muted-foreground"
        >
          <Plus className="size-4" /> {t("steps.add")}
        </button>
        {error && (
          <p role="alert" className="mt-2 text-xs text-coral">
            {error}
          </p>
        )}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <Button type="button" variant="secondary" className="h-12 rounded-xl" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button type="button" className="h-12 rounded-xl" onClick={save}>
            {t("steps.save")}
          </Button>
        </div>
      </div>
    </div>
  );
}
