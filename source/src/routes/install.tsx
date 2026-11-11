import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { InstallChoice } from "@/components/nowmode/InstallChoice";
import { ScreenHeader } from "@/components/nowmode/ScreenHeader";
import { useT } from "@/lib/i18n/context";

export const Route = createFileRoute("/install")({
  head: () => ({
    meta: [{ title: "Web or Android · Now Mode" }],
  }),
  component: InstallPage,
});

function InstallPage() {
  const t = useT();
  const navigate = useNavigate();
  return (
    <div className="pb-10">
      <ScreenHeader back title={t("install.title")} />
      <div className="px-5">
        <InstallChoice onBrowser={() => void navigate({ to: "/" })} />
      </div>
    </div>
  );
}
