import { useEffect, useState } from "react";

import { useT } from "@/lib/i18n/context";
import { Capacitor } from "@capacitor/core";
import { isNewerVersion, remoteVersion } from "@/lib/nowmode/updates";
import { UPDATE_URL } from "@/lib/nowmode/version";

const HIDE_KEY = "nowmode-update-hide";

async function publishedVersion(): Promise<string | null> {
  const platform = import.meta.env.VITE_NATIVE === "1" ? (Capacitor.getPlatform() === "ios" ? "ios" : "android") : "web";
  try {
    if (import.meta.env.VITE_NATIVE === "1") {
      const { CapacitorHttp } = await import("@capacitor/core");
      const response = await CapacitorHttp.get({ url: UPDATE_URL });
      if (response.status !== 200) return null;
      const data = typeof response.data === "string" ? JSON.parse(response.data) : response.data;
      return remoteVersion(data, platform);
    }
    const response = await fetch(UPDATE_URL, { cache: "no-store" });
    if (!response.ok) return null;
    return remoteVersion(await response.json(), "web");
  } catch {
    return null;
  }
}

/** A quiet banner when the Pages version.json is newer than this build. */
export function UpdateBanner() {
  const t = useT();
  const [version, setVersion] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    void publishedVersion().then((next) => {
      if (!live || !next || !isNewerVersion(next)) return;
      if (sessionStorage.getItem(HIDE_KEY) === next) return;
      setVersion(next);
    });
    return () => {
      live = false;
    };
  }, []);

  if (!version) return null;
  return (
    <div role="status" className="sticky top-0 z-30 border-b border-border2 bg-card px-4 py-3 text-foreground">
      <p className="text-sm font-bold">{t("update.title")}</p>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{t("update.body")}</p>
      <button
        type="button"
        className="mt-2 h-9 rounded-xl border border-border2 px-3 text-xs font-semibold"
        onClick={() => {
          sessionStorage.setItem(HIDE_KEY, version);
          setVersion(null);
        }}
      >
        {t("update.later")}
      </button>
    </div>
  );
}
