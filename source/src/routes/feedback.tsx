import { createFileRoute } from "@tanstack/react-router";
import { Copy, Mail } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { useT } from "@/lib/i18n/context";
import { ScreenHeader } from "@/components/nowmode/ScreenHeader";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/feedback")({
  head: () => ({
    meta: [
      { title: "Send feedback · Now Mode" },
      { name: "description", content: "Tell us what helps and what gets in the way in Now Mode." },
      { property: "og:title", content: "Send feedback · Now Mode" },
      { property: "og:description", content: "Tell us what helps and what gets in the way in Now Mode." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Feedback,
});

// Placeholder inbox until a real feedback channel exists.
const FEEDBACK_EMAIL = "hello@nowmode.app";

function Feedback() {
  const t = useT();
  const [text, setText] = useState("");

  return (
    <div className="pb-10">
      <ScreenHeader back title={t("nav.feedback")} />
      <div className="space-y-4 px-5">
        <p className="text-sm text-muted-foreground">{t("feedback.intro")}</p>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={7}
          placeholder={t("feedback.ph")}
          className="w-full resize-none rounded-2xl border border-border2 bg-card px-4 py-3 text-[15px] placeholder:text-dim focus:border-blue focus:outline-none"
          aria-label={t("feedback.yours")}
        />
        <div className="grid grid-cols-2 gap-3">
          <Button
            variant="secondary"
            size="lg"
            className="h-12 rounded-xl"
            disabled={!text.trim()}
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(text);
                toast(t("feedback.copied"), { description: t("feedback.copiedBody") });
              } catch {
                toast(t("feedback.fail"), { description: t("feedback.failBody") });
              }
            }}
          >
            <Copy /> {t("feedback.copy")}
          </Button>
          <Button size="lg" className="h-12 rounded-xl font-semibold" disabled={!text.trim()} asChild={!!text.trim()}>
            {text.trim() ? (
              <a href={`mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent(t("feedback.subject"))}&body=${encodeURIComponent(text)}`}>
                <Mail /> {t("feedback.email")}
              </a>
            ) : (
              <span>
                <Mail /> {t("feedback.email")}
              </span>
            )}
          </Button>
        </div>
        <p className="text-center text-xs text-dim">{t("feedback.thanks")}</p>
      </div>
    </div>
  );
}