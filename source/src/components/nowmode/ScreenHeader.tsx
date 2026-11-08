import { useRouter } from "@tanstack/react-router";
import { ChevronLeft, Menu } from "lucide-react";
import type { ReactNode } from "react";

import { useUI } from "./ui-context";

export function IconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="grid size-9 shrink-0 place-items-center rounded-xl border border-border2 bg-card text-foreground transition-colors hover:bg-card2 active:scale-95"
    >
      {children}
    </button>
  );
}

export function MenuButton() {
  const { setDrawerOpen } = useUI();
  return (
    <IconButton label="Open menu" onClick={() => setDrawerOpen(true)}>
      <Menu className="size-5" strokeWidth={1.8} />
    </IconButton>
  );
}

export function BackButton() {
  const router = useRouter();
  return (
    <IconButton
      label="Back"
      onClick={() => {
        if (window.history.length > 1) router.history.back();
        else router.navigate({ to: "/" });
      }}
    >
      <ChevronLeft className="size-5" />
    </IconButton>
  );
}

export function ScreenHeader({
  kicker,
  title,
  right,
  back = false,
}: {
  kicker?: ReactNode;
  title: ReactNode;
  right?: ReactNode;
  back?: boolean;
}) {
  return (
    <header className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-5 pb-4 pt-5">
      {back ? <BackButton /> : <MenuButton />}
      <div className="min-w-0">
        {kicker && <p className="truncate text-xs text-muted-foreground">{kicker}</p>}
        <h1 className="truncate text-[22px] font-bold leading-tight tracking-tight">{title}</h1>
      </div>
      <div className="shrink-0">{right}</div>
    </header>
  );
}

export function Pill({ children, tone = "default" }: { children: ReactNode; tone?: "default" | "green" | "blue" }) {
  const tones = {
    default: "border-border2 bg-card text-muted-foreground",
    green: "border-border2 bg-card text-green",
    blue: "border-blue/40 bg-blue/10 text-blue",
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-semibold ${tones[tone]}`}>
      {children}
    </span>
  );
}