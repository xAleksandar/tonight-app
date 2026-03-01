"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ChevronDown, Compass, Edit3, MessageCircle, Plus, User, Users } from "lucide-react";

import type { EventChatAttentionPayload } from "@/components/tonight/event-inside/EventInsideExperience";
import { classNames } from "@/lib/classNames";
import { buildChatAttentionLabels } from "@/lib/buildChatAttentionLabels";
import { buildChatAttentionLinkLabel, formatRelativeTime } from "@/lib/chatAttentionHelpers";
import { useSnoozeCountdown } from "@/hooks/useSnoozeCountdown";
import { CHAT_ATTENTION_SNOOZE_OPTIONS_MINUTES, DEFAULT_CHAT_ATTENTION_SNOOZE_MINUTES } from "@/lib/chatAttentionSnoozeOptions";

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

export type DraftQuickPickEntry = {
  conversationId: string;
  participantName: string;
  href: string;
  updatedAtISO?: string | null;
  snippet?: string | null;
};

export type MobileActionBarProps = {
  active?: MobileNavTarget | null;
  onNavigateDiscover?: () => void;
  onNavigatePeople?: () => void;
  onNavigateMessages?: () => void;
  onCreate: () => void;
  onOpenProfile: () => void;
  messagesUnreadCount?: number;
  canJumpToWaitingGuests?: boolean;
  onJumpToWaitingGuests?: () => void;
  chatAction?: MobileChatAction | null;
  chatAttentionQueue?: EventChatAttentionPayload[] | null;
  chatAttentionSnoozedUntil?: string | null;
  chatAttentionPreferredSnoozeMinutes?: number | null;
  onChatAttentionEntryHandled?: (entryId: string) => void;
  onChatAttentionClearAll?: () => void;
  onChatAttentionSnooze?: (durationMinutes?: number) => void;
  onChatAttentionResume?: () => void;
  draftsWaitingCount?: number | null;
  onJumpToDrafts?: () => void;
  draftQuickPickEntries?: DraftQuickPickEntry[] | null;
  onClearDraft?: (conversationId: string) => void;
  className?: string;
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
  canJumpToWaitingGuests,
  onJumpToWaitingGuests,
  chatAction,
  chatAttentionQueue,
  chatAttentionSnoozedUntil,
  chatAttentionPreferredSnoozeMinutes,
  onChatAttentionEntryHandled,
  onChatAttentionClearAll,
  onChatAttentionSnooze,
  onChatAttentionResume,
  draftsWaitingCount,
  onJumpToDrafts,
  draftQuickPickEntries,
  onClearDraft,
  className,
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
  const chatAttentionHasEntries = chatAttentionEntries.length > 0;
  const { isActive: chatAttentionIsSnoozed, label: chatAttentionSnoozeCountdownLabel } = useSnoozeCountdown(chatAttentionSnoozedUntil);
  const chatAttentionSnoozeLabel = chatAttentionIsSnoozed && chatAttentionSnoozeCountdownLabel
    ? `Snoozed · ${chatAttentionSnoozeCountdownLabel}`
    : chatAttentionIsSnoozed
      ? "Snoozed"
      : null;
  const quickSnoozeMinutes = chatAttentionPreferredSnoozeMinutes ?? DEFAULT_CHAT_ATTENTION_SNOOZE_MINUTES;
  const quickSnoozeButtonLabel = `Snooze for ${quickSnoozeMinutes} min`;
  const quickSnoozeAriaLabel = `Quick snooze chat attention alerts · ${quickSnoozeMinutes} min`;
  const showMessagesJumpAction = Boolean(canJumpToWaitingGuests && onJumpToWaitingGuests);
  const showQuickJumpPicker = showMessagesJumpAction && chatAttentionPickerEntries.length > 0;
  const jumpQuickPickerEntries = chatAttentionPickerEntries.slice(0, 3);
  const jumpPickerRemainderCount = Math.max(chatAttentionPickerEntries.length - jumpQuickPickerEntries.length, 0);
  const hasAdditionalJumpEntries = jumpPickerRemainderCount > 0;
  const queuedGuestCount = chatAttentionEntries.length;
  const queuedGuestCountLabel = queuedGuestCount > 0 ? `${queuedGuestCount} queued` : null;
  const showDraftsShortcut =
    typeof draftsWaitingCount === "number" && draftsWaitingCount > 0 && typeof onJumpToDrafts === "function";
  const draftsWaitingBadgeLabel = draftsWaitingCount && draftsWaitingCount > 99 ? "99+" : String(draftsWaitingCount ?? "");
  const draftsWaitingChipLabel = draftsWaitingCount === 1 ? "1 draft waiting" : `${draftsWaitingCount ?? 0} drafts waiting`;
  const draftQuickPickerEntriesSafe = useMemo(
    () =>
      (draftQuickPickEntries ?? []).filter((entry): entry is DraftQuickPickEntry => {
        return Boolean(entry?.href && entry?.participantName);
      }),
    [draftQuickPickEntries]
  );
  const hasDraftQuickPicker = showDraftsShortcut && draftQuickPickerEntriesSafe.length > 0;
  const draftQuickPickerTopEntries = draftQuickPickerEntriesSafe.slice(0, 3);
  const draftQuickPickerRemainderCount = Math.max(draftQuickPickerEntriesSafe.length - draftQuickPickerTopEntries.length, 0);

  useEffect(() => {
    if (!chatAttentionPickerAvailable && attentionPickerOpen) {
      setAttentionPickerOpen(false);
    }
  }, [chatAttentionPickerAvailable, attentionPickerOpen]);

  const [jumpPickerOpen, setJumpPickerOpen] = useState(false);
  const [draftPickerOpen, setDraftPickerOpen] = useState(false);

  useEffect(() => {
    if ((!hasAdditionalJumpEntries || !showMessagesJumpAction) && jumpPickerOpen) {
      setJumpPickerOpen(false);
    }
  }, [hasAdditionalJumpEntries, jumpPickerOpen, showMessagesJumpAction]);

  useEffect(() => {
    if ((!hasDraftQuickPicker || draftQuickPickerRemainderCount === 0) && draftPickerOpen) {
      setDraftPickerOpen(false);
    }
  }, [draftPickerOpen, hasDraftQuickPicker, draftQuickPickerRemainderCount]);

  const handleMarkAllHandled = () => {
    if (!chatAttentionHasEntries) {
      return;
    }
    setAttentionPickerOpen(false);
    setJumpPickerOpen(false);
    onChatAttentionClearAll?.();
  };

  const handleChatAttentionNavigate = () => {
    chatAction?.onInteract?.();
    setAttentionPickerOpen(false);
    setJumpPickerOpen(false);
  };

  const handleMarkHandled = (entryId?: string | null) => {
    if (!entryId) {
      return;
    }
    onChatAttentionEntryHandled?.(entryId);
  };

  return (
    <nav
      className={classNames("fixed inset-x-0 bottom-0 z-50 border-t border-border bg-card/55 pb-[env(safe-area-inset-bottom)] text-foreground shadow-[0_-18px_45px_rgba(2,6,23,0.7)] backdrop-blur-lg md:hidden", className)}
      role="navigation"
      aria-label="Primary navigation"
    >
      {showMessagesJumpAction ? (
        <div className="border-b border-white/10 px-4 pb-3 pt-4 text-white">
          <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wide text-white/60">
            <span>Guests needing replies</span>
            {queuedGuestCountLabel ? (
              <span className="rounded-full bg-primary/15 px-2 py-0.5 text-primary">{queuedGuestCountLabel}</span>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onJumpToWaitingGuests}
            className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-primary/40 bg-primary/10 px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-primary transition hover:border-primary/60 hover:bg-primary/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary/40"
            aria-label="Jump to the guests waiting for a reply"
          >
            <AlertTriangle className="h-4 w-4" aria-hidden />
            <span className="flex items-center gap-2">
              Jump to waiting guests
              {queuedGuestCountLabel ? (
                <span className="rounded-full bg-primary/20 px-2 py-0.5 text-[10px] font-semibold text-primary/90">
                  {queuedGuestCountLabel}
                </span>
              ) : null}
            </span>
          </button>
          {chatAttentionLeadLabel ? (
            <p className="mt-2 text-[11px] text-white/80">
              {chatAttentionLeadLabel}
              {chatAttentionLeadEntry?.snippet ? ` · ${chatAttentionLeadEntry.snippet}` : null}
            </p>
          ) : null}
          {showQuickJumpPicker ? (
            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wide text-white/60">
                <span>Quick picker</span>
                {chatAttentionWaitingLabel ? <span className="text-primary/80">{chatAttentionWaitingLabel}</span> : null}
              </div>
              <div className="flex flex-wrap gap-2">
                {jumpQuickPickerEntries.map((entry) => {
                  const href = entry.href.trim();
                  const label = buildChatAttentionLinkLabel(entry);
                  const relativeTime = formatRelativeTime(entry.timestampISO);
                  return (
                    <span key={entry.id} className="inline-flex items-center gap-1">
                      <Link
                        href={href}
                        prefetch={false}
                        onClick={handleChatAttentionNavigate}
                        aria-label={label}
                        className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] text-white/80 transition hover:border-primary/40 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary/40"
                      >
                        <span>{entry.authorName ?? "Guest thread"}</span>
                        {relativeTime ? <span className="text-[9px] text-white/60">{relativeTime}</span> : null}
                      </Link>
                      {entry.id && onChatAttentionEntryHandled ? (
                        <button
                          type="button"
                          onClick={() => handleMarkHandled(entry.id)}
                          className="text-[9px] font-semibold uppercase tracking-wide text-primary/70 transition hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary/40"
                          aria-label={`Mark handled${entry.authorName ? ` for ${entry.authorName}` : ''}`}
                        >
                          Mark
                        </button>
                      ) : null}
                    </span>
                  );
                })}
              </div>
              {hasAdditionalJumpEntries ? (
                <button
                  type="button"
                  onClick={() => setJumpPickerOpen((prev) => !prev)}
                  aria-expanded={jumpPickerOpen}
                  aria-controls="mobile-chat-attention-picker-jump"
                  className="text-[10px] font-semibold uppercase tracking-wide text-primary/80 transition hover:text-primary"
                >
                  View remaining guests (+{jumpPickerRemainderCount})
                </button>
              ) : null}
              {jumpPickerOpen ? (
                <div id="mobile-chat-attention-picker-jump" className="rounded-2xl border border-primary/30 bg-primary/5 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-primary">Queued guests</p>
                    <button
                      type="button"
                      onClick={() => setJumpPickerOpen(false)}
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
                            className="block rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-white/80 transition hover:border-primary/40 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary/40"
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
                          {onChatAttentionEntryHandled ? (
                            <div className="mt-1 text-right">
                              <button
                                type="button"
                                onClick={() => handleMarkHandled(entry.id)}
                                className="text-[10px] font-semibold uppercase tracking-wide text-primary/70 transition hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary/40"
                                aria-label={`Mark handled${entry.authorName ? ` for ${entry.authorName}` : ''}`}
                              >
                                Mark handled
                              </button>
                            </div>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}
          <p className="mt-2 text-[11px] text-white/70">Opens the first conversation with queued attention so you can reply faster.</p>
        </div>
      ) : null}
      {showDraftsShortcut ? (
        <div className={classNames("border-b border-white/10 px-4 pb-3 text-white", showMessagesJumpAction || hasChatAction ? "pt-3" : "pt-4")}>
          <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wide text-white/65">
            <span className="inline-flex items-center gap-2 text-white/80">
              <Edit3 className="h-3.5 w-3.5" aria-hidden /> Drafts waiting
            </span>
            <span className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-bold text-white">{draftsWaitingBadgeLabel}</span>
          </div>
          <button
            type="button"
            onClick={onJumpToDrafts}
            className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-sky-400/40 bg-sky-400/15 px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-sky-50 transition hover:border-sky-300/60 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300/40"
            aria-label={draftsWaitingChipLabel}
          >
            Jump to drafts
          </button>
          <p className="mt-2 text-[11px] text-white/70">{draftsWaitingChipLabel}</p>
          {hasDraftQuickPicker ? (
            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wide text-white/60">
                <span>Draft quick picker</span>
                <span className="text-white/45">{draftsWaitingChipLabel}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {draftQuickPickerTopEntries.map((entry) => {
                  const relativeTime = formatRelativeTime(entry.updatedAtISO);
                  const clearLabel = entry.participantName ? `Clear draft for ${entry.participantName}` : "Clear draft";
                  return (
                    <span key={`${entry.conversationId}-chip`} className="inline-flex items-center gap-1">
                      <Link
                        href={entry.href}
                        prefetch={false}
                        aria-label={`Open drafted chat with ${entry.participantName}`}
                        className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] text-white/85 transition hover:border-sky-300/60 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300/40"
                      >
                        <span>{entry.participantName}</span>
                        {relativeTime ? <span className="text-[9px] text-white/60">{relativeTime}</span> : null}
                      </Link>
                      {onClearDraft ? (
                        <button
                          type="button"
                          onClick={() => onClearDraft(entry.conversationId)}
                          className="text-[9px] font-semibold uppercase tracking-wide text-sky-100/80 transition hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300/40"
                          aria-label={clearLabel}
                        >
                          Clear
                        </button>
                      ) : null}
                    </span>
                  );
                })}
              </div>
              {draftQuickPickerRemainderCount > 0 ? (
                <button
                  type="button"
                  onClick={() => setDraftPickerOpen((prev) => !prev)}
                  aria-expanded={draftPickerOpen}
                  aria-controls="mobile-draft-quick-picker"
                  className="text-[10px] font-semibold uppercase tracking-wide text-sky-100 transition hover:text-white"
                >
                  {draftPickerOpen
                    ? "Hide remaining drafts"
                    : `View remaining drafts (+${draftQuickPickerRemainderCount})`}
                </button>
              ) : null}
              {draftPickerOpen ? (
                <div id="mobile-draft-quick-picker" className="rounded-2xl border border-white/10 bg-white/5 p-3">
                  <ul className="space-y-2">
                    {draftQuickPickerEntriesSafe.map((entry) => {
                      const relativeTime = formatRelativeTime(entry.updatedAtISO);
                      const clearLabel = entry.participantName ? `Clear draft for ${entry.participantName}` : "Clear draft";
                      return (
                        <li key={`${entry.conversationId}-draft`} className="space-y-1">
                          <Link
                            href={entry.href}
                            prefetch={false}
                            aria-label={`Open drafted chat with ${entry.participantName}`}
                            className="block rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-white/85 transition hover:border-sky-300/60 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300/40"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-sm font-semibold text-white">{entry.participantName}</span>
                              {relativeTime ? (
                                <span className="text-[10px] font-semibold uppercase tracking-wide text-white/60">{relativeTime}</span>
                              ) : null}
                            </div>
                            {entry.snippet ? (
                              <p className="mt-1 text-sm text-white/75 line-clamp-2">{entry.snippet}</p>
                            ) : null}
                          </Link>
                          {onClearDraft ? (
                            <div className="text-right">
                              <button
                                type="button"
                                onClick={() => onClearDraft(entry.conversationId)}
                                className="text-[10px] font-semibold uppercase tracking-wide text-sky-100/80 transition hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300/40"
                                aria-label={clearLabel}
                              >
                                Clear draft
                              </button>
                            </div>
                          ) : null}
                        </li>

                      );
                    })}
                  </ul>
                </div>
              ) : null}
            </div>
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
