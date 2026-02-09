"use client";

import { Compass, MessageCircle, Plus, User, Users } from "lucide-react";

import { classNames } from "@/lib/classNames";

export type MobileNavTarget = "discover" | "create" | "profile";

export type MobileActionBarProps = {
  active?: MobileNavTarget;
  onNavigateDiscover?: () => void;
  onCreate: () => void;
  onOpenProfile: () => void;
};

export function MobileActionBar({ active = "discover", onNavigateDiscover, onCreate, onOpenProfile }: MobileActionBarProps) {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border/70 bg-card/70 backdrop-blur-lg md:hidden"
      role="navigation"
      aria-label="Primary navigation"
    >
      <div className="flex items-center justify-around px-2 py-2 text-xs font-medium text-muted-foreground">
        <button
          type="button"
          onClick={onNavigateDiscover}
          className={classNames(
            "flex flex-col items-center gap-0.5",
            active === "discover" ? "text-primary" : undefined
          )}
        >
          <Compass className="h-5 w-5" />
          Discover
        </button>
        <button type="button" className="flex flex-col items-center gap-0.5 opacity-60" disabled>
          <Users className="h-5 w-5" />
          People
        </button>
        <button
          type="button"
          onClick={onCreate}
          className={classNames(
            "-mt-6 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30",
            active === "create" ? "ring-2 ring-primary/60" : undefined
          )}
          aria-label="Post event"
        >
          <Plus className="h-5 w-5" />
        </button>
        <button type="button" className="flex flex-col items-center gap-0.5 opacity-60" disabled>
          <MessageCircle className="h-5 w-5" />
          Messages
        </button>
        <button
          type="button"
          onClick={onOpenProfile}
          className={classNames(
            "flex flex-col items-center gap-0.5",
            active === "profile" ? "text-primary" : undefined
          )}
        >
          <User className="h-5 w-5" />
          Profile
        </button>
      </div>
      <div className="h-[env(safe-area-inset-bottom)]" />
    </nav>
  );
}
