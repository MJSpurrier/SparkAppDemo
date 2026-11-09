import { createFileRoute } from "@tanstack/react-router";
import { Compass, Feather, HeartHandshake, Zap } from "lucide-react";

import { useT } from "@/lib/i18n/context";
import { Logo } from "@/components/nowmode/Logo";
import { ScreenHeader } from "@/components/nowmode/ScreenHeader";

export const Route = createFileRoute("/mission")({
  head: () => ({
    meta: [
      { title: "Our Mission · Now Mode" },
      { name: "description", content: "ADHD is a superpower, not a fault. Why we're building Now Mode." },
      { property: "og:title", content: "Our Mission · Now Mode" },
      { property: "og:description", content: "ADHD is a superpower, not a fault. Why we're building Now Mode." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Mission,
});

const beliefs = [
  { icon: Zap, title: "mission.b1t", body: "mission.b1b", tone: "text-coral" },
  { icon: Compass, title: "mission.b2t", body: "mission.b2b", tone: "text-blue" },
  { icon: Feather, title: "mission.b3t", body: "mission.b3b", tone: "text-teal" },
  { icon: HeartHandshake, title: "mission.b4t", body: "mission.b4b", tone: "text-green" },
] as const;

function Mission() {
  const t = useT();
  return (
    <div className="pb-10">
      <ScreenHeader back title={t("nav.mission")} />
      <div className="space-y-5 px-5">
        <section className="rounded-[20px] border border-border2 bg-hero p-6">
          <Logo size={44} />
          <h2 className="mt-4 text-[28px] font-bold leading-[1.1] tracking-tight">
            {t("mission.headline")} <span className="text-blue">{t("mission.em")}</span>
          </h2>
          <p className="mt-3 text-sm text-muted-foreground">{t("mission.sub")}</p>
        </section>

        <ul className="grid gap-3">
          {beliefs.map(({ icon: Icon, title, body, tone }) => (
            <li key={title} className="flex gap-3 rounded-2xl border border-border bg-card p-4">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-card2">
                <Icon className={`size-4 ${tone}`} />
              </span>
              <span>
                <span className="block text-sm font-semibold">{t(title)}</span>
                <span className="mt-0.5 block text-sm text-muted-foreground">{t(body)}</span>
              </span>
            </li>
          ))}
        </ul>

        <figure className="rounded-2xl border border-border bg-bg2 p-5">
          <blockquote className="text-sm leading-relaxed text-foreground/90">
            {t("mission.quote")}
          </blockquote>
          <figcaption className="mt-3 text-xs text-dim">{t("mission.by")}</figcaption>
        </figure>
      </div>
    </div>
  );
}