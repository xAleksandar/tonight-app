"use client";

import { useEffect, useRef } from "react";
import { useAuthContext } from "@/components/auth/AuthProvider";

export function MobileStatusBar() {
  const { isAuthenticated } = useAuthContext();
  const barRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      document.documentElement.style.setProperty(
        "--mobile-statusbar-height",
        "env(safe-area-inset-top, 0px)"
      );
      return;
    }

    const element = barRef.current;
    if (!element) {
      return;
    }

    const updateHeight = () => {
      const height = element.getBoundingClientRect().height;
      document.documentElement.style.setProperty("--mobile-statusbar-height", `${height}px`);
    };

    updateHeight();

    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(updateHeight) : null;
    observer?.observe(element);

    return () => {
      observer?.disconnect();
      document.documentElement.style.setProperty(
        "--mobile-statusbar-height",
        "env(safe-area-inset-top, 0px)"
      );
    };
  }, [isAuthenticated]);

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div
      ref={barRef}
      className="sticky top-0 z-50 flex w-full flex-col border-b border-border/40 bg-background/80 text-xs font-semibold uppercase tracking-wide text-foreground/80 backdrop-blur-md md:hidden"
      style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      aria-label="Mobile status bar"
    >
      <div className="px-4 py-1" aria-hidden="true" />
    </div>
  );
}
