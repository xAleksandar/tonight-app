"use client";

import { useMemo } from "react";
import { MessageCircle, X } from "lucide-react";

import { ConversationList } from "@/components/chat/ConversationList";
import { PLACEHOLDER_CONVERSATIONS, type ConversationPreview } from "@/components/chat/conversations";

export type MessagesModalProps = {
  isOpen: boolean;
  onClose: () => void;
  conversations?: ConversationPreview[];
  onSelectConversation?: (conversationId: string) => void;
};

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
          <ConversationList conversations={items} onSelectConversation={onSelectConversation} />
        </div>
      </div>
    </div>
  );
}
