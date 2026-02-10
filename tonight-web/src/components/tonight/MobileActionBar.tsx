"use client";

import { Compass, MessageCircle, Plus, User, Users } from "lucide-react";

import { classNames } from "@/lib/classNames";

export type MobileNavTarget = "discover" | "people" | "create" | "messages" | "profile";

export type MobileActionBarProps = {
  active?: MobileNavTarget;
  onNavigateDiscover?: () => void;
  onNavigatePeople?: () => void;
  onNavigateMessages?: () => void;
  onCreate: () => void;
  onOpenProfile: () => void;
  messagesUnreadCount?: number;
};

type NavItem = {
  id: MobileNavTarget;
  label: string;
  icon: typeof Compass;
  onPress?: () => void;
  badgeCount?: number;
};

export function MobileActionBar({
  active = "discover",
  onNavigateDiscover,
  onNavigatePeople,
  onNavigateMessages,
  onCreate,
  onOpenProfile,
  messagesUnreadCount = 0,
}: MobileActionBarProps) {
  const navItems: NavItem[] = [
    { id: "discover" as const, label: "Discover", icon: Compass, onPress: onNavigateDiscover },
    { id: "people" as const, label: "People", icon: Users, onPress: onNavigatePeople },
    { id: "create" as const, label: "Post", icon: Plus, onPress: onCreate },
    {
      id: "messages" as const,
      label: "Messages",
      icon: MessageCircle,
      onPress: onNavigateMessages,
      badgeCount: messagesUnreadCount,
    },
    { id: "profile" as const, label: "Profile", icon: User, onPress: onOpenProfile },
  ];

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-card/55 text-foreground shadow-[0_-18px_45px_rgba(2,6,23,0.7)] backdrop-blur-lg md:hidden"
      role="navigation"
      aria-label="Primary navigation"
    >
      <div className="flex items-center justify-around px-2 py-2 text-xs font-medium">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = active === item.id;
          const isCreate = item.id === "create";
          const disabled = typeof item.onPress !== "function" && !isCreate;
          const badgeCount = item.badgeCount ?? 0;
          const showUnreadBadge = item.id === "messages" && badgeCount > 0;
          const unreadLabel = showUnreadBadge ? (badgeCount > 99 ? "99+" : badgeCount.toString()) : null;

          if (isCreate) {
            return (
              <button
                key={item.id}
                type="button"
                onClick={onCreate}
                className={classNames(
                  "flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                  isActive ? "ring-2 ring-primary/60" : undefined
                )}
                aria-label="Post event"
              >
                <Icon className="h-5 w-5" />
              </button>
            );
          }

          return (
            <button
              key={item.id}
              type="button"
              onClick={disabled ? undefined : item.onPress}
              className={classNames(
                "relative flex flex-col items-center gap-0.5 rounded-2xl px-3 py-1.5 text-[11px] font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                disabled
                  ? "text-muted-foreground/50"
                  : isActive
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
              )}
              data-active={isActive ? 'true' : undefined}
              aria-current={isActive ? "page" : undefined}
              aria-disabled={disabled || undefined}
              disabled={disabled}
            >
              <span
                className={classNames(
                  "pointer-events-none absolute inset-0 rounded-2xl transition-opacity",
                  isActive && !disabled
                    ? "opacity-100 bg-primary/10 shadow-[0_10px_30px_rgba(236,72,153,0.15)]"
                    : "opacity-0"
                )}
                aria-hidden
              />
              <span className="relative flex h-5 w-5 items-center justify-center">
                <Icon className="h-5 w-5" />
                {showUnreadBadge && (
                  <span className="absolute -right-2 -top-2 min-h-[16px] min-w-[16px] rounded-full bg-primary px-1 text-[10px] font-bold leading-4 text-primary-foreground shadow-[0_0_12px_rgba(14,34,255,0.35)]">
                    {unreadLabel}
                  </span>
                )}
              </span>
              <span className="relative">{item.label}</span>
            </button>
          );
        })}
      </div>
      <div className="h-[env(safe-area-inset-bottom)]" />
    </nav>
  );
}
