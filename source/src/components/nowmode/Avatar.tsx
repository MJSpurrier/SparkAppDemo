import { greetingName, initialsFor } from "@/lib/nowmode/profile";
import type { Prefs } from "@/lib/nowmode/types";

export function Avatar({ prefs, size = "size-9" }: { prefs: Prefs; size?: string }) {
  const name = greetingName(prefs);
  const initials = initialsFor(name || "?");
  if (prefs.avatar) {
    return <img src={prefs.avatar} alt="" className={`${size} shrink-0 rounded-full object-cover ring-1 ring-border2`} />;
  }
  return (
    <div className={`grid ${size} shrink-0 place-items-center rounded-full bg-card2 text-sm font-bold text-teal ring-1 ring-border2`}>
      {initials === "?" ? "Y" : initials}
    </div>
  );
}
