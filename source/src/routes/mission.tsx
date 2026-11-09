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
  { icon: Zap, title: "Interest is fuel", body: "Your brain runs on curiosity and urgency. We work with that, not against it.", tone: "text-coral" },
  { icon: Compass, title: "One thing is enough", body: "You don't need the whole map. Just the next step, right now.", tone: "text-blue" },
  { icon: Feather, title: "No shame, ever", body: "No streaks to break, no red badges. Missed things just move gently.", tone: "text-teal" },
  { icon: HeartHandshake, title: "Rest is part of it", body: "When the list is clear, you're allowed to stop. That's the point.", tone: "text-green" },
];

function Mission() {
  const t = useT();
  return (
    <div className="pb-10">
      <ScreenHeader back title={t("nav.mission")} />
      <div className="space-y-5 px-5">
        <section className="rounded-[20px] border border-border2 bg-hero p-6">
          <Logo size={44} />
          <h2 className="mt-4 text-[28px] font-bold leading-[1.1] tracking-tight">
            ADHD is a superpower, <span className="text-blue">not a fault.</span>
          </h2>
          <p className="mt-3 text-sm text-muted-foreground">
            Now Mode is a planner built for brains that live in the present tense.
          </p>
        </section>

        <ul className="grid gap-3">
          {beliefs.map(({ icon: Icon, title, body, tone }) => (
            <li key={title} className="flex gap-3 rounded-2xl border border-border bg-card p-4">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-card2">
                <Icon className={`size-4 ${tone}`} />
              </span>
              <span>
                <span className="block text-sm font-semibold">{title}</span>
                <span className="mt-0.5 block text-sm text-muted-foreground">{body}</span>
              </span>
            </li>
          ))}
        </ul>

        <figure className="rounded-2xl border border-border bg-bg2 p-5">
          <blockquote className="text-sm leading-relaxed text-foreground/90">
            “I spent years trying to plan like everyone else and feeling broken when it didn't stick. Now Mode
            is the tool I wished I had: it only ever asks what's next, and it always tells me when I'm allowed to
            rest.”
          </blockquote>
          <figcaption className="mt-3 text-xs text-dim">— The founder of Now Mode</figcaption>
        </figure>
      </div>
    </div>
  );
}