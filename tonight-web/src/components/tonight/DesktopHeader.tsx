"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ChevronDown, List as ListIcon, Map as MapIcon, MessageCircle } from "lucide-react";

import UserAvatar from "@/components/UserAvatar";
import type { EventChatAttentionPayload } from "@/components/tonight/event-inside/EventInsideExperience";
import { classNames } from "@/lib/classNames";
import { buildChatAttentionLabels } from "@/lib/buildChatAttentionLabels";
import { buildChatAttentionLinkLabel, formatRelativeTime } from "@/lib/chatAttentionHelpers";
import { useSnoozeCountdown } from "@/hooks/useSnoozeCountdown";
import { CHAT_ATTENTION_SNOOZE_OPTIONS_MINUTES } from "@/lib/chatAttentionSnoozeOptions";
import type { MobileActionBarProps } from "./MobileActionBar";

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
  chatAction?: MobileActionBarProps["chatAction"];
  chatAttentionQueue?: EventChatAttentionPayload[] | null;
  chatAttentionSnoozedUntil?: string | null;
  onChatAttentionEntryHandled?: (entryId: string) => void;
  onChatAttentionClearAll?: () => void;
  onChatAttentionSnooze?: (durationMinutes?: number) => void;
  onChatAttentionResume?: () => void;
};

type DesktopChatAction = NonNullable<MobileActionBarProps["chatAction"]>;

const CHAT_BADGE_TONE_CLASS: Record<NonNullable<DesktopChatAction["badgeTone"]>, string> = {
  highlight: "bg-primary/15 text-primary",
  success: "bg-emerald-400/15 text-emerald-100",
  muted: "bg-white/10 text-white/70",
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
  chatAction,
  chatAttentionQueue,
  chatAttentionSnoozedUntil,
  onChatAttentionEntryHandled,
  onChatAttentionClearAll,
  onChatAttentionSnooze,
  onChatAttentionResume,
}: DesktopHeaderProps) {
  const messagesDisabled = typeof onNavigateMessages !== "function";
  const canToggleView = viewMode && typeof onViewModeChange === "function";
  const hasChatAction = Boolean(chatAction?.href && chatAction?.label);
  const chatBadgeClassName = chatAction?.badgeTone ? CHAT_BADGE_TONE_CLASS[chatAction.badgeTone] : CHAT_BADGE_TONE_CLASS.muted;
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

  useEffect(() => {
    if (!chatAttentionPickerAvailable && attentionPickerOpen) {
      setAttentionPickerOpen(false);
    }
  }, [chatAttentionPickerAvailable, attentionPickerOpen]);

  const handleMarkAllHandled = () => {
    if (!chatAttentionHasEntries) {
      return;
    }
    setAttentionPickerOpen(false);
    onChatAttentionClearAll?.();
  };

  const handleChatAttentionNavigate = () => {
    chatAction?.onInteract?.();
    setAttentionPickerOpen(false);
  };

  const handleMarkHandled = (entryId?: string | null) => {
    if (!entryId) {
      return;
    }
    onChatAttentionEntryHandled?.(entryId);
  };

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

      <div className="flex items-center justify-end gap-4">
        {hasChatAction ? (
          <div className="flex w-full max-w-xs flex-col items-end gap-1 text-right">
            <Link
              href={chatAction!.href}
              prefetch={false}
              onClick={chatAction?.onInteract}
              className={classNames(
                "inline-flex items-center gap-3 rounded-2xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                chatAction?.attentionActive ? "shadow-[0_0_35px_rgba(236,72,153,0.45)] animate-[pulse_2s_ease-in-out_infinite]" : undefined
              )}
              aria-label={`Open chat (${chatAction!.label})`}
            >
              <span>{chatAction!.label}</span>
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
              <div className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-primary">
                <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" aria-hidden />
                <span>{chatAttentionLabel}</span>
                {chatAttentionHasEntries && onChatAttentionClearAll ? (
                  <button
                    type="button"
                    onClick={handleMarkAllHandled}
                    className="text-[10px] font-semibold uppercase tracking-wide text-primary/70 transition hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary/40"
                    aria-label="Mark all chat attention entries as handled"
                  >
                    Mark all handled
                  </button>
                ) : null}
              </div>
            ) : null}
            {chatAttentionLeadLabel || chatAttentionWaitingLabel ? (
              <div className="flex flex-wrap justify-end gap-2 text-[10px] font-semibold uppercase tracking-wide text-primary">
                {chatAttentionLeadLabel ? (
                  chatAttentionLeadHref ? (
                    <Link
                      href={chatAttentionLeadHref}
                      prefetch={false}
                      onClick={handleChatAttentionNavigate}
                      aria-label={chatAttentionLeadAriaLabel}
                      className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-3 py-1 text-primary/90 transition hover:bg-primary/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary/40"
                    >
                      {chatAttentionLeadLabel}
                      <span aria-hidden className="text-[10px]">↗</span>
                    </Link>
                  ) : (
                    <span className="rounded-full bg-primary/15 px-3 py-1 text-primary/90">{chatAttentionLeadLabel}</span>
                  )
                ) : null}
                {chatAttentionLeadEntry?.id && onChatAttentionEntryHandled ? (
                  <button
                    type="button"
                    onClick={() => handleMarkHandled(chatAttentionLeadEntry.id)}
                    className="text-[10px] font-semibold uppercase tracking-wide text-primary/70 transition hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary/40"
                    aria-label={`Mark handled${chatAttentionLeadEntry.authorName ? ` for ${chatAttentionLeadEntry.authorName}` : ''}`}
                  >
                    Mark handled
                  </button>
                ) : null}
                {chatAttentionWaitingLabel ? (
                  chatAttentionPickerAvailable ? (
                    <button
                      type="button"
                      onClick={() => setAttentionPickerOpen((prev) => !prev)}
                      aria-expanded={attentionPickerOpen}
                      aria-controls="desktop-chat-attention-picker"
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
            {chatAttentionHasEntries && onChatAttentionSnooze ? (
              chatAttentionIsSnoozed ? (
                <div className="mt-1 inline-flex flex-wrap items-center justify-end gap-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {chatAttentionSnoozeLabel ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-white/15 px-3 py-1 text-white/80">
                      <span className="h-1 w-1 rounded-full bg-white/70" aria-hidden />
                      {chatAttentionSnoozeLabel}
                    </span>
                  ) : null}
                  {onChatAttentionResume ? (
                    <button
                      type="button"
                      onClick={onChatAttentionResume}
                      className="text-primary/70 underline-offset-2 hover:text-primary"
                      aria-label="Resume chat attention alerts"
                    >
                      Resume alerts
                    </button>
                  ) : null}
                </div>
              ) : (
                <div className="mt-1 flex flex-wrap items-center justify-end gap-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <span className="text-muted-foreground/70">Snooze:</span>
                  {CHAT_ATTENTION_SNOOZE_OPTIONS_MINUTES.map((minutes) => (
                    <button
                      key={minutes}
                      type="button"
                      onClick={() => onChatAttentionSnooze(minutes)}
                      className="rounded-full border border-white/15 px-3 py-1 text-muted-foreground transition hover:border-white/40 hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary/40"
                      aria-label={`Snooze chat attention alerts for ${minutes} minutes`}
                    >
                      {minutes} min
                    </button>
                  ))}
                </div>
              )
            ) : null}
            {chatAttentionPickerAvailable && attentionPickerOpen ? (
              <div
                id="desktop-chat-attention-picker"
                className="mt-2 w-full rounded-2xl border border-primary/30 bg-primary/5 p-3 text-left"
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-primary">Queued guests</p>
                  <button
                    type="button"
                    onClick={() => setAttentionPickerOpen(false)}
                    className="text-[10px] font-semibold uppercase tracking-wide text-primary/80 transition hover:text-primary"
                  >
                    Hide list
                  </button>
                </div>
                <ul className="space-y-2">
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
                          className="block rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-left text-white/80 transition hover:border-primary/40 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary/40"
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
                {chatAttentionHasEntries && onChatAttentionClearAll ? (
                  <div className="mt-2 text-right">
                    <button
                      type="button"
                      onClick={handleMarkAllHandled}
                      className="text-[10px] font-semibold uppercase tracking-wide text-primary/70 transition hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary/40"
                      aria-label="Mark all chat attention entries as handled"
                    >
                      Mark all handled
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}
            {!chatAction?.attentionActive && chatAction?.helperText ? (
              <p className="text-xs text-muted-foreground line-clamp-1">{chatAction.helperText}</p>
            ) : null}
          </div>
        ) : null}
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
