"use client";

import { MessageCircle } from "lucide-react";

import { classNames } from "@/lib/classNames";

export type DesktopHeaderProps = {
  title: string;
  subtitle?: string;
  onNavigateProfile: () => void;
  onNavigateMessages?: () => void;
};

export function DesktopHeader({ title, subtitle, onNavigateProfile, onNavigateMessages }: DesktopHeaderProps) {
  const messagesDisabled = typeof onNavigateMessages !== "function";

  return (
    <header className="sticky top-0 z-30 hidden items-center justify-between border-b border-white/10 bg-background/80 px-10 py-5 text-foreground shadow-lg shadow-black/10 backdrop-blur-xl md:flex">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">Tonight</p>
        <h1 className="font-serif text-3xl font-semibold leading-tight">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={messagesDisabled ? undefined : onNavigateMessages}
          className={classNames(
            "relative flex h-11 w-11 items-center justify-center rounded-full border",
            messagesDisabled
              ? "border-border/70 text-muted-foreground"
              : "border-border/80 bg-card/60 text-muted-foreground hover:text-primary"
          )}
          aria-label="Messages"
          aria-disabled={messagesDisabled}
          disabled={messagesDisabled}
        >
          <MessageCircle className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={onNavigateProfile}
          className="flex h-11 w-11 items-center justify-center rounded-full border border-border/80 bg-card/60 text-sm font-semibold text-foreground"
          aria-label="Profile"
        >
          <span>YN</span>
        </button>
      </div>
    </header>
  );
}
