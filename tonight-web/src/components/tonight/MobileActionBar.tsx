"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Compass, MessageCircle, Plus, User, Users } from "lucide-react";

import type { EventChatAttentionPayload } from "@/components/tonight/event-inside/EventInsideExperience";
import { classNames } from "@/lib/classNames";
import { buildChatAttentionLabels } from "@/lib/buildChatAttentionLabels";
import { buildChatAttentionLinkLabel, formatRelativeTime } from "@/lib/chatAttentionHelpers";

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
  chatAttentionQueue?: EventChatAttentionPayload[] | null;
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
  chatAttentionQueue,
}: MobileActionBarProps) {
  const navItems: NavItem[] = [
    { id: "discover" as const, label: "Discover", icon: Compass, onPress: onNavigateDiscover },
    { id: "people" as const, label: "People", icon: Users, onPress: onNavigatePeople },
    { id: "create" as const, label: "Post", icon: Plus, onPress: onCreate },
    { id: "messages" as const, label: "Messages", icon: MessageCircle, onPress: onNavigateMessages, badgeCount: messagesUnreadCount },
    { id: "profile" as const, label: "Profile", icon: User, onPress: onOpenProfile },
  ];

  const hasChatAction = Boolean(chatAction?.href && chatAction?.label);
  const chatBadgeClassName = chatAction?.badgeTone
    ? CHAT_BADGE_TONE_CLASS[chatAction.badgeTone]
    : CHAT_BADGE_TONE_CLASS.muted;
  const chatAttentionLabel = chatAction?.attentionLabel ?? "New chat ping";
  const [attentionPickerOpen, setAttentionPickerOpen] = useState(false);
  const chatAttentionEntries = useMemo(
    () => (chatAttentionQueue ?? []).filter((entry): entry is EventChatAttentionPayload => Boolean(entry && entry.id)),
    [chatAttentionQueue]
  );
  const chatAttentionLabels = useMemo(() => buildChatAttentionLabels(chatAttentionEntries), [chatAttentionEntries]);
  const chatAttentionLeadEntry = chatAttentionLabels.leadEntry;
  const chatAttentionLeadLabel = chatAttentionLabels.leadLabel ?? chatAction?.attentionSourceLabel;
  const chatAttentionLeadHref = chatAttentionLeadEntry?.href ?? chatAction?.href;
  const chatAttentionLeadAriaLabel = buildChatAttentionLinkLabel(chatAttentionLeadEntry);
  const chatAttentionWaitingLabel = chatAttentionLabels.waitingLabel ?? chatAction?.attentionQueueLabel;
  const chatAttentionPickerEntries = useMemo(
    () =>
      chatAttentionEntries.filter(
        (entry): entry is EventChatAttentionPayload & { href: string } => typeof entry?.href === "string" && entry.href.trim().length > 0
      ),
    [chatAttentionEntries]
  );
  const chatAttentionPickerAvailable = chatAttentionPickerEntries.length > 1;

  useEffect(() => {
    if (!chatAttentionPickerAvailable && attentionPickerOpen) {
      setAttentionPickerOpen(false);
    }
  }, [chatAttentionPickerAvailable, attentionPickerOpen]);

  const handleChatAttentionNavigate = () => {
    chatAction?.onInteract?.();
    setAttentionPickerOpen(false);
  };

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
          {chatAttentionLeadLabel || chatAttentionWaitingLabel ? (
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-wide">
              {chatAttentionLeadLabel ? (
                chatAttentionLeadHref ? (
                  <Link
                    href={chatAttentionLeadHref}
                    prefetch={false}
                    onClick={handleChatAttentionNavigate}
                    aria-label={chatAttentionLeadAriaLabel}
                    className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-3 py-1 text-primary transition hover:bg-primary/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary/40"
                  >
                    {chatAttentionLeadLabel}
                    <span aria-hidden className="text-[10px]">↗</span>
                  </Link>
                ) : (
                  <span className="rounded-full bg-primary/15 px-3 py-1 text-primary">{chatAttentionLeadLabel}</span>
                )
              ) : null}
              {chatAttentionWaitingLabel ? (
                chatAttentionPickerAvailable ? (
                  <button
                    type="button"
                    onClick={() => setAttentionPickerOpen((prev) => !prev)}
                    aria-expanded={attentionPickerOpen}
                    aria-controls="mobile-chat-attention-picker"
                    aria-label={`View queued guests (${chatAttentionWaitingLabel})`}
                    className="inline-flex items-center gap-1 rounded-full border border-primary/30 px-3 py-1 text-primary/80 transition hover:border-primary/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary/40"
                  >
                    {chatAttentionWaitingLabel}
                    <ChevronDown
                      className={classNames("h-3 w-3 transition-transform", attentionPickerOpen ? "rotate-180" : undefined)}
                      aria-hidden
                    />
                  </button>
                ) : (
                  <span className="rounded-full border border-primary/30 px-3 py-1 text-primary/70">{chatAttentionWaitingLabel}</span>
                )
              ) : null}
            </div>
          ) : null}
          {chatAttentionPickerAvailable && attentionPickerOpen ? (
            <div
              id="mobile-chat-attention-picker"
              className="mt-2 rounded-2xl border border-primary/30 bg-primary/5 p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-primary">Queued guests</p>
                <button
                  type="button"
                  onClick={() => setAttentionPickerOpen(false)}
                  className="text-[10px] font-semibold uppercase tracking-wide text-primary/80 transition hover:text-primary"
                >
                  Hide list
                </button>
              </div>
              <ul className="mt-2 space-y-2">
                {chatAttentionPickerEntries.map((entry) => {
                  const href = entry.href.trim();
                  const label = buildChatAttentionLinkLabel(entry);
                  const relativeTime = formatRelativeTime(entry.timestampISO);
                  return (
                    <li key={entry.id}>
                      <Link
                        href={href}
                        prefetch={false}
                        onClick={handleChatAttentionNavigate}
                        aria-label={label}
                        className="block rounded-2xl border border-white/5 bg-white/5 px-3 py-2 text-white/80 transition hover:border-primary/40 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary/40"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-semibold text-white">{entry.authorName ?? "Guest thread"}</span>
                          {relativeTime ? (
                            <span className="text-[10px] font-semibold uppercase tracking-wide text-white/60">{relativeTime}</span>
                          ) : null}
                        </div>
                        {entry.snippet ? <p className="mt-1 text-sm text-white/70 line-clamp-2">{entry.snippet}</p> : null}
                        {entry.helperText ? (
                          <p className="mt-1 text-[10px] uppercase tracking-wide text-primary/80">{entry.helperText}</p>
                        ) : null}
                      </Link>
                    </li>
                  );
                })}
              </ul>
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
              data-active={isActive ? "true" : undefined}
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
