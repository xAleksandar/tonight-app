import { BadgeCheck, Clock, MessageCircle, Sparkles } from "lucide-react";

import { classNames } from "@/lib/classNames";
import type { ConversationPreview } from "@/components/chat/conversations";

type ConversationListProps = {
  conversations: ConversationPreview[];
  onSelectConversation?: (conversationId: string) => void;
  emptyState?: {
    title: string;
    description: string;
  };
};

export function ConversationList({ conversations, onSelectConversation, emptyState }: ConversationListProps) {
  const hasConversations = conversations.length > 0;

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
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {conversations.map((conversation) => (
        <li key={conversation.id}>
          <button
            type="button"
            onClick={
              conversation.status === "accepted" && onSelectConversation
                ? () => onSelectConversation(conversation.id)
                : undefined
            }
            className={classNames(
              "group flex w-full items-center gap-3 rounded-2xl border border-border/80 bg-card/30 px-4 py-3 text-left transition hover:border-primary/40 hover:bg-card/50",
              conversation.status === "accepted" ? "cursor-pointer" : "cursor-default"
            )}
          >
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
          </button>
        </li>
      ))}
    </ul>
  );
}
