import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import { reportLovableError } from "../lib/lovable-error-reporting";
import { AppShell } from "@/components/nowmode/AppShell";
import { UIProvider } from "@/components/nowmode/ui-context";
import { Toaster } from "@/components/ui/sonner";
import { activeLocale, LocaleProvider, resolvedLocale, translate } from "@/lib/i18n/context";
import { applyAppearance, normalizePalette, normalizeTheme } from "@/lib/nowmode/settings";
import { NowModeProvider, useNowMode } from "@/lib/nowmode/store";

function NotFoundComponent() {
  const locale = activeLocale();
  const t = (key: Parameters<typeof translate>[1]) => translate(locale, key);
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">{t("error.notFound")}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{t("error.notFoundBody")}</p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {t("error.goHome")}
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  const locale = activeLocale();
  const t = (key: Parameters<typeof translate>[1]) => translate(locale, key);
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">{t("error.failed")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("error.failedBody")}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {t("error.retry")}
          </button>
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            {t("error.goHome")}
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function Appearance({ children }: { children: ReactNode }) {
  const { state } = useNowMode();
  const locale = resolvedLocale(state.prefs.locale, typeof navigator === "undefined" ? "en" : navigator.language);
  const mode = state.prefs.themeMode
    ? normalizeTheme(state.prefs.themeMode)
    : typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: light)").matches
      ? "light"
      : "dark";
  const palette = normalizePalette(state.prefs.palette);
  useEffect(() => {
    applyAppearance(mode, palette);
    document.documentElement.lang = locale === "en" ? "en" : locale;
    if (import.meta.env.VITE_NATIVE === "1") {
      void import("@/lib/nowmode/native-chrome").then((mod) => mod.syncChrome(mode, palette));
      void import("@/lib/nowmode/push").then((mod) => mod.initPushIfConfigured());
    }
  }, [mode, palette, locale]);
  return <LocaleProvider locale={locale}>{children}</LocaleProvider>;
}

function ThemedToaster() {
  const { state } = useNowMode();
  const mode = state.prefs.themeMode
    ? normalizeTheme(state.prefs.themeMode)
    : typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: light)").matches
      ? "light"
      : "dark";
  return <Toaster theme={mode} />;
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <NowModeProvider>
        <Appearance>
          <UIProvider>
            <AppShell>
              <Outlet />
            </AppShell>
            <ThemedToaster />
          </UIProvider>
        </Appearance>
      </NowModeProvider>
    </QueryClientProvider>
  );
}
