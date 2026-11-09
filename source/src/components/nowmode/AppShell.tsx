import type { ReactNode } from "react";

import { AddSheet } from "./AddSheet";
import { ScheduleDialog } from "./ScheduleDialog";
import { SideDrawer } from "./SideDrawer";
import { TabBar } from "./TabBar";
import { TimerSwitchDialog } from "./TimerSwitchDialog";

/** Phone-sized frame on larger screens, full-bleed on phones. */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh w-full justify-center bg-background sm:items-center sm:bg-bg2 sm:py-6">
      <div className="relative flex h-dvh w-full flex-col overflow-hidden bg-background sm:h-[844px] sm:max-h-[calc(100dvh-3rem)] sm:max-w-[390px] sm:rounded-[2.5rem] sm:border sm:border-border2 sm:shadow-shell">
        <div className="relative min-h-0 flex-1">
          <main className="no-scrollbar h-full overflow-y-auto">{children}</main>
          <AddSheet />
          <ScheduleDialog />
          <TimerSwitchDialog />
        </div>
        <TabBar />
        <SideDrawer />
      </div>
    </div>
  );
}