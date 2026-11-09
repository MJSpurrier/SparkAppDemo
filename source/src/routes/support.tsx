import { createFileRoute } from "@tanstack/react-router";
import { HandHeart } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { useT } from "@/lib/i18n/context";
import { ScreenHeader } from "@/components/nowmode/ScreenHeader";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/support")({
  head: () => ({
    meta: [
      { title: "Support Now Mode" },
      { name: "description", content: "Chip in to keep Now Mode growing — always optional, the app stays usable." },
      { property: "og:title", content: "Support Now Mode" },
      { property: "og:description", content: "Chip in to keep Now Mode growing — always optional, the app stays usable." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Support,
});

const PRESETS = [3, 5, 10];

function Support() {
  const t = useT();
  const [freq, setFreq] = useState<"once" | "monthly">("once");
  const [amount, setAmount] = useState<number | "custom">(5);
  const [custom, setCustom] = useState("");
  const value = amount === "custom" ? Number(custom) || 0 : amount;

  return (
    <div className="pb-10">
      <ScreenHeader back title={t("nav.support")} />
      <div className="space-y-5 px-5">
        <section className="rounded-[20px] border border-border2 bg-hero p-5">
          <HandHeart className="size-6 text-coral" />
          <h2 className="mt-3 text-xl font-bold">{t("support.headline")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("support.body")}</p>
        </section>

        <div className="grid grid-cols-2 gap-2 rounded-2xl border border-border bg-bg2 p-1" role="radiogroup" aria-label={t("support.freq")}>
          {(["once", "monthly"] as const).map((f) => (
            <button
              key={f}
              type="button"
              role="radio"
              aria-checked={freq === f}
              onClick={() => setFreq(f)}
              className={cn(
                "rounded-xl py-2.5 text-sm font-semibold transition-colors",
                freq === f ? "bg-card2 text-foreground" : "text-dim",
              )}
            >
              {f === "once" ? t("support.once") : t("support.monthly")}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-label={t("support.amount")}>
          {PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              role="radio"
              aria-checked={amount === p}
              onClick={() => setAmount(p)}
              className={cn(
                "rounded-xl border py-3 text-base font-bold transition-colors",
                amount === p ? "border-blue/60 bg-blue/15 text-blue" : "border-border2 bg-card",
              )}
            >
              ${p}
            </button>
          ))}
          <button
            type="button"
            role="radio"
            aria-checked={amount === "custom"}
            onClick={() => setAmount("custom")}
            className={cn(
              "rounded-xl border py-3 text-sm font-semibold transition-colors",
              amount === "custom" ? "border-blue/60 bg-blue/15 text-blue" : "border-border2 bg-card text-muted-foreground",
            )}
          >
            {t("support.custom")}
          </button>
        </div>
        {amount === "custom" && (
          <label className="flex h-12 items-center gap-2 rounded-xl border border-border2 bg-card px-4 focus-within:border-blue">
            <span className="text-muted-foreground">$</span>
            <input
              autoFocus
              inputMode="decimal"
              value={custom}
              onChange={(e) => setCustom(e.target.value.replace(/[^\d.]/g, ""))}
              placeholder={t("support.any")}
              className="w-full bg-transparent text-base focus:outline-none"
              aria-label={t("support.any")}
            />
          </label>
        )}

        <Button
          size="lg"
          className="h-12 w-full rounded-xl text-[15px] font-semibold"
          disabled={value <= 0}
          onClick={() =>
            toast(t("support.thanks"), { description: t("support.thanksBody") })
          }
        >
          {t("support.button", { amount: value || 0 })}
          {freq === "monthly" ? t("support.month") : ""}
        </Button>
        <p className="text-center text-xs text-dim">{t("support.preview")}</p>
      </div>
    </div>
  );
}