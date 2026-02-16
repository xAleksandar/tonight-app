"use client";

import Link from "next/link";
import { Compass, MessageCircle, Plus, User, Users } from "lucide-react";

import { classNames } from "@/lib/classNames";

export type MobileNavTarget = "discover" | "people" | "create" | "messages" | "profile";

type MobileChatAction = {
  href: string;
  label: string;
  helperText?: string | null;
  badgeLabel?: string | null;
  badgeTone?: "highlight" | "success" | "muted";
  attentionActive?: boolean;
  attentionLabel?: string | null;
  attentionSourceLabel?: string | null;
  attentionQueueLabel?: string | null;
  attentionQueueCount?: number;
  lastMessageSnippet?: string | null;
  lastMessageAuthorName?: string | null;
  lastMessageAtISO?: string | null;
  onInteract?: () => void;
};

export type MobileActionBarProps = {
  active?: MobileNavTarget | null;
  onNavigateDiscover?: () => void;
  onNavigatePeople?: () => void;
  onNavigateMessages?: () => void;
  onCreate: () => void;
  onOpenProfile: () => void;
  messagesUnreadCount?: number;
  chatAction?: MobileChatAction | null;
};

type NavItem = {
  id: MobileNavTarget;
  label: string;
  icon: typeof Compass;
  onPress?: () => void;
  badgeCount?: number;
};

const CHAT_BADGE_TONE_CLASS: Record<NonNullable<MobileChatAction["badgeTone"]>, string> = {
  highlight: "bg-primary/20 text-primary",
  success: "bg-emerald-400/15 text-emerald-200",
  muted: "bg-white/10 text-white/70",
};

export function MobileActionBar({
  active,
  onNavigateDiscover,
  onNavigatePeople,
  onNavigateMessages,
  onCreate,
  onOpenProfile,
  messagesUnreadCount = 0,
  chatAction,
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

  const hasChatAction = Boolean(chatAction?.href && chatAction?.label);
  const chatBadgeClassName = chatAction?.badgeTone
    ? CHAT_BADGE_TONE_CLASS[chatAction.badgeTone]
    : CHAT_BADGE_TONE_CLASS.muted;
  const chatAttentionLabel = chatAction?.attentionLabel ?? "New chat ping";

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-card/55 pb-[env(safe-area-inset-bottom)] text-foreground shadow-[0_-18px_45px_rgba(2,6,23,0.7)] backdrop-blur-lg md:hidden"
      role="navigation"
      aria-label="Primary navigation"
    >
      {hasChatAction ? (
        <div className="border-b border-white/10 px-4 pb-2 pt-4 text-white">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-white/60">Event chat</p>
          <Link
            href={chatAction!.href}
            prefetch={false}
            onClick={chatAction?.onInteract}
            className={classNames(
              "mt-2 inline-flex w-full items-center justify-between gap-3 rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
              chatAction?.attentionActive ? "shadow-[0_0_25px_rgba(236,72,153,0.45)] animate-[pulse_1.8s_ease-in-out_infinite]" : null
            )}
            aria-label={`Open chat (${chatAction!.label})`}
          >
            <span className="text-left">{chatAction!.label}</span>
            {chatAction?.badgeLabel ? (
              <span
                className={classNames(
                  "rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide",
                  chatBadgeClassName
                )}
              >
                {chatAction.badgeLabel}
              </span>
            ) : null}
          </Link>
          {chatAction?.attentionActive ? (
            <div className="mt-2 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-primary">
              <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" aria-hidden />
              <span>{chatAttentionLabel}</span>
            </div>
          ) : null}
          {chatAction?.attentionSourceLabel || chatAction?.attentionQueueLabel ? (
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-wide">
              {chatAction?.attentionSourceLabel ? (
                <span className="rounded-full bg-primary/15 px-3 py-1 text-primary">{chatAction.attentionSourceLabel}</span>
              ) : null}
              {chatAction?.attentionQueueLabel ? (
                <span className="rounded-full border border-primary/30 px-3 py-1 text-primary/80">
                  {chatAction.attentionQueueLabel}
                </span>
              ) : null}
            </div>
          ) : null}
          {chatAction?.helperText ? (
            <p className="mt-2 text-[11px] text-white/70 line-clamp-2">{chatAction.helperText}</p>
          ) : null}
        </div>
      ) : null}
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
    </nav>
  );
}
