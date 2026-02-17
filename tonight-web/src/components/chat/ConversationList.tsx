import { useMemo, type KeyboardEvent } from "react";
import { AlertTriangle, BadgeCheck, Clock, MessageCircle, Sparkles } from "lucide-react";

import type { EventChatAttentionPayload } from "@/components/tonight/event-inside/EventInsideExperience";
import { formatRelativeTime } from "@/lib/chatAttentionHelpers";
import { classNames } from "@/lib/classNames";
import type { ConversationPreview } from "@/components/chat/conversations";

type ConversationListProps = {
  conversations: ConversationPreview[];
  onSelectConversation?: (conversationId: string) => void;
  emptyState?: {
    title: string;
    description: string;
  };
  emptyStateAction?: {
    label: string;
    onAction: () => void;
  };
  attentionQueue?: EventChatAttentionPayload[];
  onAttentionEntryHandled?: (entryId: string) => void;
};

const buildAttentionLookup = (entries?: EventChatAttentionPayload[] | null) => {
  const map = new Map<string, EventChatAttentionPayload>();
  (entries ?? []).forEach((entry) => {
    if (entry && typeof entry.id === "string" && entry.id.trim().length > 0) {
      map.set(entry.id, entry);
    }
  });
  return map;
};

export function ConversationList({
  conversations,
  onSelectConversation,
  emptyState,
  emptyStateAction,
  attentionQueue,
  onAttentionEntryHandled,
}: ConversationListProps) {
  const hasConversations = conversations.length > 0;
  const attentionLookup = useMemo(() => buildAttentionLookup(attentionQueue), [attentionQueue]);

  if (!hasConversations) {
    const emptyTitle = emptyState?.title ?? "No messages yet";
    const emptyDescription =
      emptyState?.description ??
      "Join a meetup and you'll be able to keep the conversation going right here once the host approves you.";

    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border/60 bg-card/30 px-6 py-16 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
          <MessageCircle className="h-7 w-7 text-primary" />
        </div>
        <p className="text-sm font-semibold text-foreground">{emptyTitle}</p>
        <p className="max-w-sm text-xs text-muted-foreground">{emptyDescription}</p>
        {emptyStateAction ? (
          <button
            type="button"
            onClick={emptyStateAction.onAction}
            className="mt-4 inline-flex items-center justify-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-primary transition hover:bg-primary/15"
          >
            {emptyStateAction.label}
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {conversations.map((conversation) => {
        const attentionEntry = attentionLookup.get(conversation.id);
        const attentionTimestamp = attentionEntry?.timestampISO ? formatRelativeTime(attentionEntry.timestampISO) : null;

        const isClickable = conversation.status === "accepted" && typeof onSelectConversation === "function";

        const handleRowKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
          if (!isClickable || !onSelectConversation) {
            return;
          }
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onSelectConversation(conversation.id);
          }
        };

        return (
          <li key={conversation.id}>
            <div
              role={isClickable ? "button" : undefined}
              tabIndex={isClickable ? 0 : -1}
              onClick={isClickable && onSelectConversation ? () => onSelectConversation(conversation.id) : undefined}
              onKeyDown={isClickable ? handleRowKeyDown : undefined}
              className={classNames(
                "group flex w-full flex-col gap-3 rounded-2xl border border-border/80 bg-card/30 px-4 py-3 text-left transition hover:border-primary/40 hover:bg-card/50",
                isClickable ? "cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary/40" : "cursor-default"
              )}
            >
              <div className="flex items-center gap-3">
                <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl border border-border/60 bg-card/60 font-semibold">
                  <span>
                    {conversation.participantName
                      .split(" ")
                      .map((segment) => segment.charAt(0))
                      .join("")}
                  </span>
                  {conversation.unreadCount ? (
                    <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                      {conversation.unreadCount}
                    </span>
                  ) : null}
                </div>
                <div className="flex flex-1 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold leading-tight text-foreground">{conversation.participantName}</p>
                    {conversation.status === "pending" ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-300">
                        <Clock className="h-3 w-3" /> Pending
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-200">
                        <BadgeCheck className="h-3 w-3" /> Accepted
                      </span>
                    )}
                    {attentionEntry ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                        <AlertTriangle className="h-3 w-3" /> Needs reply
                      </span>
                    ) : null}
                  </div>
                  <p className="text-xs text-muted-foreground">{conversation.eventTitle}</p>
                  <p
                    className={classNames(
                      "text-sm",
                      conversation.unreadCount ? "font-semibold text-foreground" : "text-muted-foreground"
                    )}
                  >
                    {conversation.messageSnippet}
                  </p>
                  {attentionEntry ? (
                    <div className="mt-1 rounded-2xl border border-primary/30 bg-primary/5 p-3 text-sm text-primary">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-semibold uppercase tracking-wide">
                        <span className="inline-flex items-center gap-1 text-primary">
                          <MessageCircle className="h-3 w-3" /> Guest pinged
                        </span>
                        {attentionTimestamp ? (
                          <span className="text-primary/80">{attentionTimestamp}</span>
                        ) : null}
                      </div>
                      {attentionEntry.snippet ? (
                        <p className="mt-1 text-sm text-primary/90 line-clamp-2">{attentionEntry.snippet}</p>
                      ) : null}
                      <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-semibold uppercase tracking-wide">
                        {attentionEntry.helperText ? (
                          <span className="rounded-full border border-primary/30 px-3 py-1 text-primary/80">
                            {attentionEntry.helperText}
                          </span>
                        ) : null}
                        {attentionEntry.id && onAttentionEntryHandled ? (
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              onAttentionEntryHandled(attentionEntry.id);
                            }}
                            className="rounded-full border border-primary/30 px-3 py-1 text-primary/90 transition hover:border-primary/60"
                          >
                            Mark handled
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </div>
                <div className="flex flex-col items-end gap-1 text-xs text-muted-foreground">
                  <span>{conversation.updatedAtLabel}</span>
                  {conversation.eventCategoryLabel ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-border/60 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      <Sparkles className="h-3 w-3" />
                      {conversation.eventCategoryLabel}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
