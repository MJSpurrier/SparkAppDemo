import { createFileRoute } from "@tanstack/react-router";

import { ScreenHeader } from "@/components/nowmode/ScreenHeader";
import { useT } from "@/lib/i18n/context";

const PUBLIC_POLICY = "https://mjspurrier.github.io/SparkAppDemo/privacy.html";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy · Now Mode" },
      { name: "description", content: "Now Mode keeps plans on this device and does not collect them." },
    ],
  }),
  component: Privacy,
});

function Privacy() {
  const t = useT();
  return (
    <div className="pb-10">
      <ScreenHeader back title={t("privacy.title")} />
      <div className="space-y-4 px-5">
        <section className="rounded-[20px] border border-border2 bg-hero p-5">
          <h2 className="text-[26px] font-bold leading-tight tracking-tight">{t("privacy.lead")}</h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{t("privacy.p1")}</p>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{t("privacy.p2")}</p>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{t("privacy.p3")}</p>
        </section>
        <p className="px-1 text-xs leading-relaxed text-dim">{t("privacy.public", { url: PUBLIC_POLICY })}</p>
      </div>
    </div>
  );
}
