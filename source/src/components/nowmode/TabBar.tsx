import { Link } from "@tanstack/react-router";
import { CalendarDays, Home, Plus, Target, Waypoints } from "lucide-react";

import { cn } from "@/lib/utils";
import { useUI } from "./ui-context";

const left = [
  { to: "/", label: "Today", icon: Home },
  { to: "/calendar", label: "Calendar", icon: CalendarDays },
] as const;
const right = [
  { to: "/board", label: "Board", icon: Waypoints },
  { to: "/focus", label: "Focus", icon: Target },
] as const;

function Tab({ to, label, icon: Icon }: { to: string; label: string; icon: typeof Home }) {
  return (
    <Link
      to={to}
      activeOptions={{ exact: true }}
      className="group flex flex-1 flex-col items-center gap-1 py-1 text-[10px] font-medium text-dim transition-colors data-[status=active]:font-semibold data-[status=active]:text-foreground"
    >
      <Icon className="size-[22px]" strokeWidth={1.8} aria-hidden />
      <span>{label}</span>
    </Link>
  );
}

export function TabBar() {
  const { sheetOpen, openSheet, closeSheet } = useUI();
  return (
    <nav
      aria-label="Main"
      className="relative z-30 flex shrink-0 items-center border-t border-border bg-background px-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2"
    >
      {left.map((t) => (
        <Tab key={t.to} {...t} />
      ))}
      <div className="flex flex-1 justify-center">
        <button
          type="button"
          aria-label={sheetOpen ? "Close add sheet" : "Add something"}
          aria-expanded={sheetOpen}
          onClick={() => (sheetOpen ? closeSheet() : openSheet("all"))}
          className={cn(
            "grid h-9 w-12 place-items-center rounded-xl transition-all duration-200 active:scale-95",
            sheetOpen ? "bg-blue text-primary-foreground shadow-glow" : "bg-cream text-ink",
          )}
        >
          <Plus className={cn("size-5 transition-transform duration-200", sheetOpen && "rotate-45")} strokeWidth={2.2} />
        </button>
      </div>
      {right.map((t) => (
        <Tab key={t.to} {...t} />
      ))}
    </nav>
  );
}