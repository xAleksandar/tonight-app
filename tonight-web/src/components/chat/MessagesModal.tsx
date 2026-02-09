"use client";

import { useMemo } from "react";
import { BadgeCheck, Clock, MessageCircle, Sparkles, X } from "lucide-react";

import { classNames } from "@/lib/classNames";

export type ConversationPreview = {
  id: string;
  participantName: string;
  eventTitle: string;
  eventCategoryLabel?: string;
  messageSnippet: string;
  updatedAtLabel: string;
  status: "pending" | "accepted";
  unreadCount?: number;
};

export type MessagesModalProps = {
  isOpen: boolean;
  onClose: () => void;
  conversations?: ConversationPreview[];
  onSelectConversation?: (conversationId: string) => void;
};

const PLACEHOLDER_CONVERSATIONS: ConversationPreview[] = [
  {
    id: "demo-1",
    participantName: "Elena K.",
    eventTitle: "Sushi Dinner",
    eventCategoryLabel: "Food",
    messageSnippet: "Great! See you at 9 then. I'll be at the bar.",
    updatedAtLabel: "5 min ago",
    status: "accepted",
    unreadCount: 2,
  },
  {
    id: "demo-2",
    participantName: "Sofia M.",
    eventTitle: "Live Jazz Night",
    eventCategoryLabel: "Music",
    messageSnippet: "Looking forward to it! Do you know the band?",
    updatedAtLabel: "1 hour ago",
    status: "accepted",
  },
  {
    id: "demo-3",
    participantName: "Dan P.",
    eventTitle: "Evening Gym Session",
    eventCategoryLabel: "Fitness",
    messageSnippet: "Waiting for host response...",
    updatedAtLabel: "2 hours ago",
    status: "pending",
  },
];

export function MessagesModal({
  isOpen,
  onClose,
  conversations,
  onSelectConversation,
}: MessagesModalProps) {
  const items = useMemo(() => {
    if (Array.isArray(conversations) && conversations.length) {
      return conversations;
    }
    return PLACEHOLDER_CONVERSATIONS;
  }, [conversations]);

  if (!isOpen) {
    return null;
  }

  const hasConversations = items.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <button
        type="button"
        aria-label="Close messages"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        className="relative z-10 flex w-full max-w-2xl flex-col gap-4 rounded-3xl border border-white/10 bg-gradient-to-b from-[#11142a] via-[#0c1022] to-[#070912] p-6 text-foreground shadow-2xl shadow-black/50"
      >
        <header className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">Tonight</p>
            <h2 className="text-2xl font-serif font-semibold leading-tight">Messages</h2>
            <p className="text-sm text-muted-foreground">Keep up with hosts and guests you've matched with.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-white/10 p-2 text-white/80 transition hover:text-white"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <section className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card/40 px-4 py-3 text-sm text-muted-foreground">
          <MessageCircle className="h-4 w-4 text-primary" />
          Conversations unlock after a host accepts your join request. Pending chats will show up here automatically.
        </section>

        <div className="max-h-[60vh] overflow-y-auto pr-1">
          {hasConversations ? (
            <ul className="space-y-2">
              {items.map((conversation) => (
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
                      <span>{conversation.participantName.split(" ").map((segment) => segment.charAt(0)).join("")}</span>
                      {conversation.unreadCount ? (
                        <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                          {conversation.unreadCount}
                        </span>
                      ) : null}
                    </div>
                    <div className="flex flex-1 flex-col gap-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold leading-tight text-foreground">
                          {conversation.participantName}
                        </p>
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
          ) : (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border/60 bg-card/30 px-6 py-16 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
                <MessageCircle className="h-7 w-7 text-primary" />
              </div>
              <p className="text-sm font-semibold text-foreground">No messages yet</p>
              <p className="max-w-sm text-xs text-muted-foreground">
                Join a meetup and you&apos;ll be able to keep the conversation going right here once the host approves you.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
