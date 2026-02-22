"use client";

import { useEffect, useMemo, useState } from "react";
import { BatteryFull, Signal, Wifi } from "lucide-react";

import { useAuthContext } from "@/components/auth/AuthProvider";

const getTimeLabel = () => {
  const now = new Date();
  try {
    return new Intl.DateTimeFormat(undefined, {
      hour: "numeric",
      minute: "2-digit",
    }).format(now);
  } catch {
    return now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }
};

export function MobileStatusBar() {
  const { isAuthenticated } = useAuthContext();
  const [timeLabel, setTimeLabel] = useState<string>(() => getTimeLabel());

  useEffect(() => {
    const interval = window.setInterval(() => {
      setTimeLabel(getTimeLabel());
    }, 30_000);

    return () => {
      window.clearInterval(interval);
    };
  }, []);

  const statusIcons = useMemo(
    () => (
      <div className="flex items-center gap-1 text-foreground/70">
        <Signal className="h-3.5 w-3.5" aria-hidden="true" />
        <Wifi className="h-3.5 w-3.5" aria-hidden="true" />
        <BatteryFull className="h-4 w-4" aria-hidden="true" />
      </div>
    ),
    []
  );

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div
      className="sticky top-0 z-50 flex w-full flex-col border-b border-border/40 bg-background/80 text-xs font-semibold uppercase tracking-wide text-foreground/80 backdrop-blur-md md:hidden"
      style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      aria-label="Mobile status bar"
    >
      <div className="flex items-center justify-between px-4 py-2">
        <span suppressHydrationWarning>{timeLabel}</span>
        {statusIcons}
      </div>
    </div>
  );
}
