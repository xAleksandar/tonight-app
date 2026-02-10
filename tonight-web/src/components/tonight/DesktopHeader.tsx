"use client";

import { List as ListIcon, Map as MapIcon, MessageCircle } from "lucide-react";

import UserAvatar from "@/components/UserAvatar";
import { classNames } from "@/lib/classNames";

export type DesktopHeaderProps = {
  title: string;
  subtitle?: string;
  unreadCount?: number;
  onNavigateProfile: () => void;
  onNavigateMessages?: () => void;
  viewMode?: "list" | "map";
  onViewModeChange?: (mode: "list" | "map") => void;
  userDisplayName?: string | null;
  userEmail?: string | null;
  userPhotoUrl?: string | null;
};

export function DesktopHeader({
  title,
  subtitle,
  unreadCount = 0,
  onNavigateProfile,
  onNavigateMessages,
  viewMode,
  onViewModeChange,
  userDisplayName,
  userEmail,
  userPhotoUrl,
}: DesktopHeaderProps) {
  const messagesDisabled = typeof onNavigateMessages !== "function";
  const canToggleView = viewMode && typeof onViewModeChange === "function";

  return (
    <header className="sticky top-0 z-30 hidden border-b border-white/10 bg-background/85 px-10 py-3 text-foreground shadow-lg shadow-black/10 backdrop-blur-xl md:grid md:grid-cols-3 md:items-center">
      <div>
        <h1 className="font-serif text-3xl font-semibold leading-tight">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
      </div>

      <div className="flex justify-center">
        {canToggleView && (
          <div className="flex items-center rounded-full border border-border/70 bg-card/60 p-1 text-sm font-semibold">
            <button
              type="button"
              onClick={() => onViewModeChange?.("list")}
              className={classNames(
                "flex items-center gap-1.5 rounded-full px-4 py-1.5 transition-colors",
                viewMode === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              )}
              aria-pressed={viewMode === "list"}
            >
              <ListIcon className="h-4 w-4" />
              List
            </button>
            <button
              type="button"
              onClick={() => onViewModeChange?.("map")}
              className={classNames(
                "flex items-center gap-1.5 rounded-full px-4 py-1.5 transition-colors",
                viewMode === "map" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              )}
              aria-pressed={viewMode === "map"}
            >
              <MapIcon className="h-4 w-4" />
              Map
            </button>
          </div>
        )}
      </div>

      <div className="flex items-center justify-end gap-3">
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
          {unreadCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
              {unreadCount}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={onNavigateProfile}
          className="relative flex h-11 w-11 items-center justify-center rounded-full text-sm font-semibold text-foreground transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          aria-label="Profile"
        >
          <UserAvatar
            displayName={userDisplayName ?? undefined}
            email={userEmail ?? undefined}
            photoUrl={userPhotoUrl ?? undefined}
            size="sm"
            className="h-11 w-11 border border-border/70 bg-card/70 text-foreground"
            initialsClassName="text-[13px]"
          />
        </button>
      </div>
    </header>
  );
}
