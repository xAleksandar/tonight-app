"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Edit3, List as ListIcon, Map as MapIcon, MessageCircle } from "lucide-react";

import UserAvatar from "@/components/UserAvatar";
import { classNames } from "@/lib/classNames";
import { formatRelativeTime } from "@/lib/chatAttentionHelpers";
import type { DraftQuickPickEntry, MobileActionBarProps } from "./MobileActionBar";

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
  // Legacy chat props retained for compatibility (unused in desktop header)
  chatAction?: MobileActionBarProps["chatAction"];
  chatAttentionQueue?: unknown;
  chatAttentionSnoozedUntil?: string | null;
  chatAttentionPreferredSnoozeMinutes?: number | null;
  onChatAttentionEntryHandled?: (entryId: string) => void;
  onChatAttentionClearAll?: () => void;
  onChatAttentionSnooze?: (durationMinutes?: number) => void;
  onChatAttentionResume?: () => void;
  canJumpToWaitingGuests?: boolean;
  onJumpToWaitingGuests?: () => void;
  draftsWaitingCount?: number | null;
  onJumpToDrafts?: () => void;
  draftQuickPickEntries?: DraftQuickPickEntry[] | null;
  onClearDraft?: (conversationId: string) => void;
};

export function DesktopHeader({
  title,
  subtitle,
  onNavigateProfile,
  onNavigateMessages,
  viewMode,
  onViewModeChange,
  userDisplayName,
  userEmail,
  userPhotoUrl,
  draftsWaitingCount,
  onJumpToDrafts,
  draftQuickPickEntries,
  onClearDraft,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  chatAction: _chatAction,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  chatAttentionQueue: _chatAttentionQueue,
}: DesktopHeaderProps) {
  const messagesDisabled = typeof onNavigateMessages !== "function";
  const canToggleView = viewMode && typeof onViewModeChange === "function";

  const showDraftsShortcut =
    typeof draftsWaitingCount === "number" && draftsWaitingCount > 0 && typeof onJumpToDrafts === "function";
  const draftsWaitingBadgeLabel = draftsWaitingCount && draftsWaitingCount > 99 ? "99+" : String(draftsWaitingCount ?? "");
  const draftsWaitingChipLabel = draftsWaitingCount === 1 ? "1 draft waiting" : `${draftsWaitingCount ?? 0} drafts waiting`;

  const draftQuickPickEntriesSafe = useMemo(
    () =>
      (draftQuickPickEntries ?? []).filter((entry): entry is DraftQuickPickEntry => {
        return Boolean(entry?.href && entry?.participantName);
      }),
    [draftQuickPickEntries]
  );
  const hasDraftQuickPicker = showDraftsShortcut && draftQuickPickEntriesSafe.length > 0;
  const draftQuickPickerTopEntries = draftQuickPickEntriesSafe.slice(0, 3);
  const draftQuickPickerRemainderCount = Math.max(draftQuickPickEntriesSafe.length - draftQuickPickerTopEntries.length, 0);
  const [draftPickerOpen, setDraftPickerOpen] = useState(false);

  useEffect(() => {
    if ((!hasDraftQuickPicker || draftQuickPickerRemainderCount === 0) && draftPickerOpen) {
      setDraftPickerOpen(false);
    }
  }, [draftPickerOpen, hasDraftQuickPicker, draftQuickPickerRemainderCount]);

  const renderDraftsShortcutButton = (options?: { fullWidth?: boolean }) => {
    if (!showDraftsShortcut || !onJumpToDrafts) {
      return null;
    }
    return (
      <button
        type="button"
        onClick={onJumpToDrafts}
        className={classNames(
          "inline-flex items-center justify-between gap-2 rounded-2xl border border-sky-400/40 bg-sky-400/10 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-sky-100 transition hover:border-sky-300/60 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300/40",
          options?.fullWidth ? "w-full" : "max-w-xs"
        )}
        aria-label={draftsWaitingChipLabel}
      >
        <span className="inline-flex items-center gap-2">
          <Edit3 className="h-3.5 w-3.5" aria-hidden />
          Drafts waiting
        </span>
        <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold text-white/90">{draftsWaitingBadgeLabel}</span>
      </button>
    );
  };

  const renderDraftQuickPicker = (options?: { fullWidth?: boolean }) => {
    if (!hasDraftQuickPicker) {
      return null;
    }
    return (
      <div
        className={classNames(
          "rounded-2xl border border-sky-400/25 bg-sky-400/10 p-3 text-left text-sky-100",
          options?.fullWidth ? "w-full" : "max-w-xs"
        )}
      >
        <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wide text-sky-100/80">
          <span>Draft quick picker</span>
          <span>{draftsWaitingChipLabel}</span>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {draftQuickPickerTopEntries.map((entry) => {
            const relativeTime = formatRelativeTime(entry.updatedAtISO);
            const clearLabel = `Clear draft for ${entry.participantName}`;
            return (
              <div key={entry.conversationId} className="inline-flex items-center gap-1">
                <Link
                  href={entry.href}
                  prefetch={false}
                  aria-label={`Open drafted chat with ${entry.participantName}`}
                  className="inline-flex items-center gap-1 rounded-full border border-sky-300/30 bg-sky-400/15 px-3 py-1 text-[11px] text-sky-50/90 transition hover:border-sky-200/60 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300/40"
                >
                  <span>{entry.participantName}</span>
                  {relativeTime ? <span className="text-[9px] text-sky-100/70">{relativeTime}</span> : null}
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
              </div>
            );
          })}
        </div>
        {draftQuickPickerRemainderCount > 0 ? (
          <button
            type="button"
            onClick={() => setDraftPickerOpen((prev) => !prev)}
            aria-expanded={draftPickerOpen}
            aria-controls="desktop-draft-quick-picker"
            className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-sky-100/80 transition hover:text-white"
          >
            {draftPickerOpen ? "Hide remaining drafts" : `View remaining drafts (+${draftQuickPickerRemainderCount})`}
          </button>
        ) : null}
        {draftPickerOpen ? (
          <div id="desktop-draft-quick-picker" className="mt-2 rounded-2xl border border-sky-300/30 bg-sky-400/5 p-3">
            <ul className="space-y-2">
              {draftQuickPickEntriesSafe.map((entry) => {
                const relativeTime = formatRelativeTime(entry.updatedAtISO);
                const clearLabel = `Clear draft for ${entry.participantName}`;
                return (
                  <li key={`${entry.conversationId}-draft`} className="space-y-1">
                    <Link
                      href={entry.href}
                      prefetch={false}
                      aria-label={`Open drafted chat with ${entry.participantName}`}
                      className="block rounded-2xl border border-sky-300/25 bg-sky-400/10 px-3 py-2 text-sky-50/90 transition hover:border-sky-200/60 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300/40"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-white">{entry.participantName}</span>
                        {relativeTime ? (
                          <span className="text-[10px] font-semibold uppercase tracking-wide text-sky-100/70">{relativeTime}</span>
                        ) : null}
                      </div>
                      {entry.snippet ? <p className="mt-1 text-sm text-sky-50/80 line-clamp-2">{entry.snippet}</p> : null}
                    </Link>
                    {onClearDraft ? (
                      <div className="text-right">
                        <button
                          type="button"
                          onClick={() => onClearDraft(entry.conversationId)}
                          className="text-[10px] font-semibold uppercase tracking-wide text-sky-100/75 transition hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300/40"
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
    );
  };

  return (
    <header className="sticky top-0 z-30 hidden border-b border-white/10 bg-background/85 px-10 py-3 text-foreground shadow-lg shadow-black/10 backdrop-blur-xl md:block">
      <div className="mx-auto grid w-full max-w-[1344px] grid-cols-3 items-center">
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

        <div className="flex flex-wrap items-center justify-end gap-4">
          {showDraftsShortcut ? (
            <div className="flex w-full max-w-xs flex-col gap-3">
              {renderDraftsShortcutButton()}
              {renderDraftQuickPicker()}
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
      </div>
    </header>
  );
}
