import { createFileRoute } from "@tanstack/react-router";
import { BellRing, Moon, LogOut, Palette, Timer } from "lucide-react";
import type { ReactNode } from "react";
import { toast } from "sonner";

import { Loading } from "@/components/nowmode/Loading";
import { ScreenHeader } from "@/components/nowmode/ScreenHeader";
import { Switch } from "@/components/ui/switch";
import { useNowMode } from "@/lib/nowmode/store";

export const Route = createFileRoute("/account")({
  head: () => ({
    meta: [
      { title: "Account · Now Mode" },
      { name: "description", content: "Your Now Mode profile, plan, and gentle nudge preferences." },
      { property: "og:title", content: "Account · Now Mode" },
      { property: "og:description", content: "Your Now Mode profile, plan, and gentle nudge preferences." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Account,
});

function Row({ icon, title, hint, children }: { icon: ReactNode; title: string; hint: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3.5">
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-card2 text-muted-foreground">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{title}</span>
        <span className="block text-xs text-dim">{hint}</span>
      </span>
      {children}
    </div>
  );
}

function Account() {
  const { ready, state, setPrefs } = useNowMode();
  if (!ready) return <Loading />;
  const p = state.prefs;

  return (
    <div className="pb-8">
      <ScreenHeader back title="Account" />
      <div className="space-y-5 px-5">
        <section className="flex items-center gap-4 rounded-[20px] border border-border2 bg-hero p-5">
          <div className="grid size-14 shrink-0 place-items-center rounded-full bg-card2 text-xl font-bold text-teal ring-1 ring-border2">
            Y
          </div>
          <div className="min-w-0">
            <p className="truncate text-lg font-bold">Your name</p>
            <p className="truncate text-sm text-muted-foreground">you@example.com</p>
            <span className="mt-2 inline-block rounded-full border border-blue/40 bg-blue/10 px-2.5 py-0.5 text-[11px] font-semibold text-blue">
              Now Mode Free
            </span>
          </div>
        </section>

        <section>
          <h2 className="px-1 pb-2 text-[11px] font-bold uppercase tracking-wider text-dim">Gentle settings</h2>
          <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
            <Row icon={<BellRing className="size-4" />} title="Layered nudges" hint="Glance · Nudge · Pull · Due">
              <Switch checked={p.layeredNudges} onCheckedChange={(v) => setPrefs({ layeredNudges: v })} aria-label="Layered nudges" />
            </Row>
            <Row icon={<Timer className="size-4" />} title="Focus reminders" hint="Soft heads-up at 2 minutes left">
              <Switch checked={p.focusReminders} onCheckedChange={(v) => setPrefs({ focusReminders: v })} aria-label="Focus reminders" />
            </Row>
            <Row icon={<Moon className="size-4" />} title="Quiet hours" hint="No nudges 10pm – 7am">
              <Switch checked={p.quietHours} onCheckedChange={(v) => setPrefs({ quietHours: v })} aria-label="Quiet hours" />
            </Row>
            <Row icon={<Palette className="size-4" />} title="Theme" hint="Easy on the eyes">
              <span className="text-sm font-semibold text-muted-foreground">Dark · calm</span>
            </Row>
          </div>
        </section>

        <button
          type="button"
          onClick={() => toast("Accounts are coming soon", { description: "Everything stays saved on this device for now." })}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-border bg-card py-3.5 text-sm font-semibold text-muted-foreground hover:text-foreground"
        >
          <LogOut className="size-4" /> Sign out
        </button>
        <p className="text-center text-xs text-dim">Your plans live on this device only.</p>
      </div>
    </div>
  );
}