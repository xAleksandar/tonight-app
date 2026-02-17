"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, BadgeCheck, MapPin, MessageCircle, Send, ShieldCheck, Sparkles, Users } from "lucide-react";

import type { EventChatAttentionPayload } from "@/components/tonight/event-inside/EventInsideExperience";
import { ConversationList } from "@/components/chat/ConversationList";
import { PLACEHOLDER_CONVERSATIONS, hasPlaceholderConversationData, type ConversationPreview } from "@/components/chat/conversations";
import { AuthStatusMessage } from "@/components/auth/AuthStatusMessage";
import type { AuthUser } from "@/components/auth/AuthProvider";
import { DesktopHeader } from "@/components/tonight/DesktopHeader";
import { DesktopSidebar } from "@/components/tonight/DesktopSidebar";
import { MobileActionBar } from "@/components/tonight/MobileActionBar";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { useSocket } from "@/hooks/useSocket";
import { useSnoozeCountdown } from "@/hooks/useSnoozeCountdown";
import type { CategoryId } from "@/lib/categories";
import { classNames } from "@/lib/classNames";
import { formatRelativeTime } from "@/lib/chatAttentionHelpers";
import { readChatAttentionQueueFromStorage, subscribeToChatAttentionQueueStorage, writeChatAttentionQueueToStorage } from "@/lib/chatAttentionQueueStorage";
import {
  CHAT_ATTENTION_SNOOZE_OPTIONS_MINUTES,
  DEFAULT_CHAT_ATTENTION_SNOOZE_MINUTES,
  type ChatAttentionSnoozeOptionMinutes,
} from "@/lib/chatAttentionSnoozeOptions";
import {
  CHAT_ATTENTION_SNOOZE_DATA_ATTRIBUTE,
  CHAT_ATTENTION_SNOOZE_PREFERENCE_STORAGE_KEY,
  CHAT_ATTENTION_SNOOZE_STORAGE_KEY,
} from "@/lib/chatAttentionStorage";
import { showSuccessToast } from "@/lib/toast";
import type { SocketMessagePayload } from "@/lib/socket-shared";

export default function MessagesPage() {
  const { status, user } = useRequireAuth();

  if (status === "loading") {
    return <AuthStatusMessage label="Checking your session…" />;
  }

  if (status === "unauthenticated") {
    return <AuthStatusMessage label="Redirecting you to the welcome screen…" />;
  }

  if (status === "error") {
    return <AuthStatusMessage label="We couldn't verify your session. Refresh to try again." />;
  }

  return <AuthenticatedMessagesPage currentUser={user ?? null} />;
}

export type ConversationFilter = "all" | "accepted" | "pending";

export const buildMessagesFilterAttentionCounts = (
  conversations: Array<Pick<ConversationPreview, "id" | "status">>,
  queue?: EventChatAttentionPayload[] | null
): Record<ConversationFilter, number> => {
  const counts: Record<ConversationFilter, number> = {
    all: 0,
    accepted: 0,
    pending: 0,
  };

  if (!queue?.length) {
    return counts;
  }

  const statusByConversationId = new Map<string, ConversationFilter>();
  conversations.forEach((conversation) => {
    statusByConversationId.set(conversation.id, conversation.status);
  });

  queue.forEach((entry) => {
    if (!entry?.id) {
      return;
    }
    counts.all += 1;
    const status = statusByConversationId.get(entry.id);
    if (status === "accepted" || status === "pending") {
      counts[status] += 1;
    }
  });

  return counts;
};

export type MessagesAttentionJumpTarget = {
  conversationId: string;
  filter: ConversationFilter;
};

export const findMessagesAttentionJumpTarget = (
  conversations: ConversationPreview[],
  queue?: EventChatAttentionPayload[] | null
): MessagesAttentionJumpTarget | null => {
  if (!Array.isArray(queue) || queue.length === 0 || !Array.isArray(conversations) || conversations.length === 0) {
    return null;
  }

  const conversationById = new Map<string, ConversationPreview>();
  conversations.forEach((conversation) => {
    if (conversation?.id) {
      conversationById.set(conversation.id, conversation);
    }
  });

  for (const entry of queue) {
    if (!entry?.id) {
      continue;
    }
    const conversation = conversationById.get(entry.id);
    if (conversation) {
      return {
        conversationId: conversation.id,
        filter: conversation.status,
      };
    }
  }

  return null;
};

const chatAttentionQueuesMatch = (a: EventChatAttentionPayload[], b: EventChatAttentionPayload[]): boolean => {
  if (a.length !== b.length) {
    return false;
  }
  return a.every((entry, index) => entry.id === b[index]?.id);
};

function AuthenticatedMessagesPage({ currentUser }: { currentUser: AuthUser | null }) {
  const router = useRouter();
  const [selectedCategory, setSelectedCategory] = useState<CategoryId | null>(null);
  const [conversations, setConversations] = useState<ConversationPreview[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<ConversationFilter>("all");
  const [chatAttentionQueue, setChatAttentionQueue] = useState<EventChatAttentionPayload[]>([]);
  const [pendingAttentionScrollTarget, setPendingAttentionScrollTarget] = useState<string | null>(null);

  const [chatAttentionSnoozedUntil, setChatAttentionSnoozedUntil] = useState<string | null>(null);
  const [chatAttentionPreferredSnoozeMinutes, setChatAttentionPreferredSnoozeMinutes] = useState<ChatAttentionSnoozeOptionMinutes>(
    DEFAULT_CHAT_ATTENTION_SNOOZE_MINUTES
  );
  const [hasHydratedSnoozeState, setHasHydratedSnoozeState] = useState(false);
  const chatAttentionSnoozeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const conversationListWrapperRef = useRef<HTMLDivElement | null>(null);

  const clearChatAttentionSnoozeTimeout = useCallback(() => {
    if (chatAttentionSnoozeTimeoutRef.current) {
      clearTimeout(chatAttentionSnoozeTimeoutRef.current);
      chatAttentionSnoozeTimeoutRef.current = null;
    }
  }, []);

  const scheduleChatAttentionSnoozeWake = useCallback(
    (targetISO: string | null) => {
      clearChatAttentionSnoozeTimeout();
      if (!targetISO) {
        return;
      }
      const targetTimestamp = Date.parse(targetISO);
      if (Number.isNaN(targetTimestamp)) {
        return;
      }
      const delay = Math.max(targetTimestamp - Date.now(), 0);
      chatAttentionSnoozeTimeoutRef.current = setTimeout(() => {
        chatAttentionSnoozeTimeoutRef.current = null;
        setChatAttentionSnoozedUntil(null);
        showSuccessToast("Chat alerts back on", "We'll nudge you again when guests reach out.");
      }, delay);
    },
    [clearChatAttentionSnoozeTimeout, showSuccessToast]
  );

  const fetchConversations = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch('/api/conversations');

      if (!response.ok) {
        throw new Error('Failed to load conversations');
      }

      const data = await response.json();
      setConversations(data.conversations);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load conversations');
      console.error('Error fetching conversations:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (currentUser) {
      fetchConversations();
    }
  }, [currentUser, fetchConversations]);

  useEffect(() => {
    setChatAttentionQueue(readChatAttentionQueueFromStorage());
    return subscribeToChatAttentionQueueStorage((nextQueue) => {
      setChatAttentionQueue((current) => (chatAttentionQueuesMatch(current, nextQueue) ? current : nextQueue));
    });
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      setHasHydratedSnoozeState(true);
      return;
    }

    const storedSnoozeUntil = window.localStorage.getItem(CHAT_ATTENTION_SNOOZE_STORAGE_KEY);
    if (storedSnoozeUntil) {
      const timestamp = Date.parse(storedSnoozeUntil);
      if (!Number.isNaN(timestamp) && timestamp > Date.now()) {
        setChatAttentionSnoozedUntil(storedSnoozeUntil);
        scheduleChatAttentionSnoozeWake(storedSnoozeUntil);
      } else {
        window.localStorage.removeItem(CHAT_ATTENTION_SNOOZE_STORAGE_KEY);
      }
    }

    const storedPreferenceRaw = window.localStorage.getItem(CHAT_ATTENTION_SNOOZE_PREFERENCE_STORAGE_KEY);
    if (storedPreferenceRaw) {
      const parsed = Number(storedPreferenceRaw);
      if (CHAT_ATTENTION_SNOOZE_OPTIONS_MINUTES.includes(parsed as ChatAttentionSnoozeOptionMinutes)) {
        setChatAttentionPreferredSnoozeMinutes(parsed as ChatAttentionSnoozeOptionMinutes);
      }
    }

    setHasHydratedSnoozeState(true);

    return () => {
      clearChatAttentionSnoozeTimeout();
    };
  }, [scheduleChatAttentionSnoozeWake, clearChatAttentionSnoozeTimeout]);

  useEffect(() => {
    if (!hasHydratedSnoozeState) {
      return;
    }

    if (typeof document !== "undefined") {
      const root = document.documentElement;
      if (chatAttentionSnoozedUntil) {
        root.dataset[CHAT_ATTENTION_SNOOZE_DATA_ATTRIBUTE] = chatAttentionSnoozedUntil;
      } else {
        delete root.dataset[CHAT_ATTENTION_SNOOZE_DATA_ATTRIBUTE];
      }
    }

    if (typeof window !== "undefined") {
      if (chatAttentionSnoozedUntil) {
        window.localStorage.setItem(CHAT_ATTENTION_SNOOZE_STORAGE_KEY, chatAttentionSnoozedUntil);
      } else {
        window.localStorage.removeItem(CHAT_ATTENTION_SNOOZE_STORAGE_KEY);
      }
    }
  }, [chatAttentionSnoozedUntil, hasHydratedSnoozeState]);

  useEffect(() => {
    if (!hasHydratedSnoozeState || typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(
      CHAT_ATTENTION_SNOOZE_PREFERENCE_STORAGE_KEY,
      String(chatAttentionPreferredSnoozeMinutes)
    );
  }, [chatAttentionPreferredSnoozeMinutes, hasHydratedSnoozeState]);

  // Socket.IO connection for real-time updates
  const handleMessage = useCallback((payload: SocketMessagePayload) => {
    // Update conversation list when new message arrives
    setConversations(prev => {
      const updated = prev.map(conv => {
        if (conv.id === payload.joinRequestId) {
          return {
            ...conv,
            messageSnippet: payload.content,
            updatedAtLabel: 'Just now',
            // Increment unread if message from other user
            unreadCount: payload.senderId !== currentUser?.id
              ? (conv.unreadCount ?? 0) + 1
              : (conv.unreadCount ?? 0)
          };
        }
        return conv;
      });

      // Return updated list (ConversationList component will handle sorting if needed)
      return updated;
    });
  }, [currentUser?.id]);

  useSocket({
    token: null, // Token will be read from cookies automatically
    autoConnect: true,
    onMessage: handleMessage
  });

  const hasOnlyPlaceholders = useMemo(() => hasPlaceholderConversationData(conversations), [conversations]);

  const filterCounts = useMemo(() => {
    let accepted = 0;
    let pending = 0;
    conversations.forEach((conversation) => {
      if (conversation.status === "accepted") {
        accepted += 1;
      } else if (conversation.status === "pending") {
        pending += 1;
      }
    });
    return {
      all: conversations.length,
      accepted,
      pending,
    } satisfies Record<ConversationFilter, number>;
  }, [conversations]);

  const attentionCountsByFilter = useMemo(
    () => buildMessagesFilterAttentionCounts(conversations, chatAttentionQueue),
    [conversations, chatAttentionQueue]
  );

  const attentionJumpTarget = useMemo(
    () => findMessagesAttentionJumpTarget(conversations, chatAttentionQueue),
    [conversations, chatAttentionQueue]
  );
  const canJumpToWaitingGuests = Boolean(attentionJumpTarget);

  const filteredConversations = useMemo(() => {
    if (statusFilter === "all") {
      return conversations;
    }
    return conversations.filter((conversation) => conversation.status === statusFilter);
  }, [conversations, statusFilter]);

  useEffect(() => {
    if (!pendingAttentionScrollTarget) {
      return;
    }
    if (typeof window === "undefined") {
      return;
    }
    const container = conversationListWrapperRef.current;
    if (!container) {
      return;
    }
    const nodes = Array.from(container.querySelectorAll<HTMLElement>("[data-conversation-id]"));
    const targetNode = nodes.find((node) => node.dataset.conversationId === pendingAttentionScrollTarget);
    if (!targetNode) {
      return;
    }

    targetNode.scrollIntoView({ behavior: "smooth", block: "center" });
    const highlightClasses = ["ring-2", "ring-primary/60", "ring-offset-2", "ring-offset-background"];
    highlightClasses.forEach((className) => targetNode.classList.add(className));

    const timeoutId = window.setTimeout(() => {
      highlightClasses.forEach((className) => targetNode.classList.remove(className));
    }, 1600);

    setPendingAttentionScrollTarget(null);

    return () => {
      window.clearTimeout(timeoutId);
      highlightClasses.forEach((className) => targetNode.classList.remove(className));
    };
  }, [pendingAttentionScrollTarget, filteredConversations]);

  const handleSelectConversation = useCallback(
    (conversationId: string) => {
      if (!conversationId || conversationId.startsWith("demo-")) {
        return;
      }
      router.push(`/chat/${conversationId}`);
    },
    [router]
  );

  const handleJumpToWaitingGuests = useCallback(() => {
    if (!attentionJumpTarget) {
      return;
    }
    setStatusFilter(attentionJumpTarget.filter);
    setPendingAttentionScrollTarget(attentionJumpTarget.conversationId);
  }, [attentionJumpTarget, setStatusFilter, setPendingAttentionScrollTarget]);

  const handleChatAttentionEntryHandled = useCallback((entryId: string) => {
    if (!entryId) {
      return;
    }
    setChatAttentionQueue((current) => {
      const next = current.filter((entry) => entry.id !== entryId);
      if (next.length === current.length) {
        return current;
      }
      writeChatAttentionQueueToStorage(next);
      showSuccessToast("Marked handled", "We'll keep the rest of the queue for you.");
      return next;
    });
  }, []);

  const handleChatAttentionClearAll = useCallback(() => {
    setChatAttentionQueue((current) => {
      if (!current.length) {
        return current;
      }
      const confirmMessage =
        current.length === 1
          ? "Mark the current chat ping as handled?"
          : `Mark all ${current.length} chat pings as handled?`;
      const confirmed = typeof window === "undefined" ? true : window.confirm(confirmMessage);
      if (!confirmed) {
        return current;
      }
      writeChatAttentionQueueToStorage([]);
      showSuccessToast("Attention cleared", "We cleared the inbox alerts from this list.");
      return [];
    });
  }, []);

  const handleChatAttentionSnooze = useCallback(
    (durationMinutes?: number) => {
      const fallbackMinutes = chatAttentionPreferredSnoozeMinutes ?? DEFAULT_CHAT_ATTENTION_SNOOZE_MINUTES;
      const safeMinutes = typeof durationMinutes === "number" && durationMinutes > 0 ? durationMinutes : fallbackMinutes;
      const snoozeUntil = new Date(Date.now() + safeMinutes * 60 * 1000).toISOString();
      setChatAttentionSnoozedUntil(snoozeUntil);
      const durationLabel = safeMinutes === 1 ? "minute" : "minutes";
      showSuccessToast("Chat alerts snoozed", `We'll remind you again in about ${safeMinutes} ${durationLabel}.`);
      scheduleChatAttentionSnoozeWake(snoozeUntil);
      if (CHAT_ATTENTION_SNOOZE_OPTIONS_MINUTES.includes(safeMinutes as ChatAttentionSnoozeOptionMinutes)) {
        setChatAttentionPreferredSnoozeMinutes(safeMinutes as ChatAttentionSnoozeOptionMinutes);
      }
    },
    [chatAttentionPreferredSnoozeMinutes, scheduleChatAttentionSnoozeWake, showSuccessToast]
  );

  const handleChatAttentionResume = useCallback(() => {
    if (!chatAttentionSnoozedUntil) {
      return;
    }
    clearChatAttentionSnoozeTimeout();
    setChatAttentionSnoozedUntil(null);
    showSuccessToast("Chat alerts back on", "We'll nudge you again when guests reach out.");
  }, [chatAttentionSnoozedUntil, clearChatAttentionSnoozeTimeout, showSuccessToast]);

  const handleCreate = useCallback(() => router.push("/events/create"), [router]);
  const handleDiscover = useCallback(() => router.push("/"), [router]);
  const handlePeople = useCallback(() => router.push("/people"), [router]);
  const handleProfile = useCallback(() => router.push("/profile"), [router]);
  const handleMessages = useCallback(() => router.push("/messages"), [router]);

  const headline = hasOnlyPlaceholders ? "You're all caught up" : "Latest conversations";

  const filterOptions = useMemo(
    () =>
      [
        { id: "all" as ConversationFilter, label: "All", description: "Every chat", count: filterCounts.all },
        {
          id: "accepted" as ConversationFilter,
          label: "Accepted",
          description: "Ready to chat",
          count: filterCounts.accepted,
        },
        {
          id: "pending" as ConversationFilter,
          label: "Pending",
          description: "Waiting on hosts",
          count: filterCounts.pending,
        },
      ].map((option) => ({
        ...option,
        attentionCount: attentionCountsByFilter[option.id] ?? 0,
      })),
    [filterCounts, attentionCountsByFilter]
  );

  const emptyStateByFilter = useMemo<Record<ConversationFilter, { title: string; description: string }>>(
    () => ({
      all: {
        title: "No messages yet",
        description:
          "Join a meetup and you'll be able to keep the conversation going right here once the host approves you.",
      },
      accepted: {
        title: "No accepted chats",
        description: "Once a host approves you, the full conversation unlocks instantly with typing states and receipts.",
      },
      pending: {
        title: "No pending requests",
        description: "Send a few join requests from Discover to see them tracked here while you wait for hosts.",
      },
    }),
    []
  );

  const emptyStateAction = useMemo(
    () => ({ label: "Browse Discover", onAction: handleDiscover }),
    [handleDiscover]
  );

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-dvh bg-gradient-to-b from-[#05070f] via-[#05060d] to-[#04040a] text-foreground">
        <div className="flex min-h-dvh flex-col md:flex-row">
          <DesktopSidebar
            selectedCategory={selectedCategory}
            onCategoryChange={setSelectedCategory}
            onCreate={handleCreate}
            onNavigateDiscover={handleDiscover}
            onNavigatePeople={handlePeople}
            onNavigateMessages={handleMessages}
            activePrimaryNav="messages"
          />
          <div className="flex flex-1 flex-col">
            <DesktopHeader
              title="Messages"
              subtitle="Keep pace with the hosts and guests you've matched with"
              onNavigateProfile={handleProfile}
              onNavigateMessages={handleMessages}
              userDisplayName={currentUser?.displayName ?? null}
              userEmail={currentUser?.email ?? null}
              userPhotoUrl={currentUser?.photoUrl ?? null}
              chatAttentionQueue={chatAttentionQueue}
              chatAttentionSnoozedUntil={chatAttentionSnoozedUntil}
              chatAttentionPreferredSnoozeMinutes={chatAttentionPreferredSnoozeMinutes}
              onChatAttentionEntryHandled={handleChatAttentionEntryHandled}
              onChatAttentionClearAll={handleChatAttentionClearAll}
              onChatAttentionSnooze={handleChatAttentionSnooze}
              onChatAttentionResume={handleChatAttentionResume}
              canJumpToWaitingGuests={canJumpToWaitingGuests}
              onJumpToWaitingGuests={handleJumpToWaitingGuests}
            />
            <main className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-muted-foreground">Loading conversations...</p>
              </div>
            </main>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-dvh bg-gradient-to-b from-[#05070f] via-[#05060d] to-[#04040a] text-foreground">
        <div className="flex min-h-dvh flex-col md:flex-row">
          <DesktopSidebar
            selectedCategory={selectedCategory}
            onCategoryChange={setSelectedCategory}
            onCreate={handleCreate}
            onNavigateDiscover={handleDiscover}
            onNavigatePeople={handlePeople}
            onNavigateMessages={handleMessages}
            activePrimaryNav="messages"
          />
          <div className="flex flex-1 flex-col">
            <DesktopHeader
              title="Messages"
              subtitle="Keep pace with the hosts and guests you've matched with"
              onNavigateProfile={handleProfile}
              onNavigateMessages={handleMessages}
              userDisplayName={currentUser?.displayName ?? null}
              userEmail={currentUser?.email ?? null}
              userPhotoUrl={currentUser?.photoUrl ?? null}
              chatAttentionQueue={chatAttentionQueue}
              chatAttentionSnoozedUntil={chatAttentionSnoozedUntil}
              chatAttentionPreferredSnoozeMinutes={chatAttentionPreferredSnoozeMinutes}
              onChatAttentionEntryHandled={handleChatAttentionEntryHandled}
              onChatAttentionClearAll={handleChatAttentionClearAll}
              onChatAttentionSnooze={handleChatAttentionSnooze}
              onChatAttentionResume={handleChatAttentionResume}
              canJumpToWaitingGuests={canJumpToWaitingGuests}
              onJumpToWaitingGuests={handleJumpToWaitingGuests}
            />
            <main className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <p className="text-destructive mb-4">{error}</p>
                <button
                  onClick={fetchConversations}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
                >
                  Retry
                </button>
              </div>
            </main>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-gradient-to-b from-[#05070f] via-[#05060d] to-[#04040a] text-foreground">
      <div className="flex min-h-dvh flex-col md:flex-row">
        <DesktopSidebar
          selectedCategory={selectedCategory}
          onCategoryChange={setSelectedCategory}
          onCreate={handleCreate}
          onNavigateDiscover={handleDiscover}
          onNavigatePeople={handlePeople}
          onNavigateMessages={handleMessages}
          activePrimaryNav="messages"
        />

        <div className="flex flex-1 flex-col">
          <DesktopHeader
            title="Messages"
            subtitle="Keep pace with the hosts and guests you've matched with"
            onNavigateProfile={handleProfile}
            onNavigateMessages={handleMessages}
            userDisplayName={currentUser?.displayName ?? null}
            userEmail={currentUser?.email ?? null}
            userPhotoUrl={currentUser?.photoUrl ?? null}
            chatAttentionQueue={chatAttentionQueue}
            chatAttentionSnoozedUntil={chatAttentionSnoozedUntil}
            chatAttentionPreferredSnoozeMinutes={chatAttentionPreferredSnoozeMinutes}
            onChatAttentionEntryHandled={handleChatAttentionEntryHandled}
            onChatAttentionClearAll={handleChatAttentionClearAll}
            onChatAttentionSnooze={handleChatAttentionSnooze}
            onChatAttentionResume={handleChatAttentionResume}
            canJumpToWaitingGuests={canJumpToWaitingGuests}
            onJumpToWaitingGuests={handleJumpToWaitingGuests}
          />

          <main className="flex-1 px-4 pb-28 pt-4 md:px-10 md:pb-12 md:pt-8">
            <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
              <MessagesMobileHero />
              <MessagesHero />

              <div className="grid gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                <section className="rounded-3xl border border-border/60 bg-card/40 p-5 shadow-lg shadow-black/30">
                  <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-primary/80">Tonight</p>
                      <h2 className="font-serif text-2xl font-semibold leading-snug">{headline}</h2>
                      <p className="text-sm text-muted-foreground">Accepted requests open the full chat. Pending ones stay here until a host approves you.</p>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground/80">
                      <span className="inline-flex items-center gap-1 rounded-full border border-border/60 px-3 py-1">Auto-refreshing</span>
                      <span className="inline-flex items-center gap-1 rounded-full border border-border/60 px-3 py-1">Secure &amp; private</span>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="flex flex-wrap gap-2">
                      {filterOptions.map((option) => {
                        const isActive = statusFilter === option.id;
                        const attentionCount = option.attentionCount ?? 0;
                        const showAttention = attentionCount > 0;
                        const attentionLabel =
                          attentionCount === 1 ? "1 guest needs a reply" : `${attentionCount} guests need replies`;

                        return (
                          <button
                            key={option.id}
                            type="button"
                            onClick={() => setStatusFilter(option.id)}
                            className={classNames(
                              "inline-flex flex-col items-start gap-1 rounded-2xl border px-4 py-2 text-xs font-semibold uppercase tracking-wide transition",
                              isActive
                                ? "border-primary/50 bg-primary/10 text-primary"
                                : "border-border/60 text-muted-foreground hover:text-foreground"
                            )}
                            aria-pressed={isActive}
                            aria-label={
                              showAttention
                                ? `${option.label} conversations, ${attentionLabel}`
                                : `${option.label} conversations`
                            }
                          >
                            <span className="inline-flex items-center gap-2">
                              <span>{option.label}</span>
                              <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-foreground/80">
                                {option.count}
                              </span>
                            </span>
                            {showAttention ? (
                              <span className="inline-flex items-center gap-1 rounded-full border border-primary/50 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-primary">
                                <AlertTriangle className="h-3 w-3" /> {attentionLabel}
                              </span>
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                    {canJumpToWaitingGuests ? (
                      <button
                        type="button"
                        onClick={handleJumpToWaitingGuests}
                        className="inline-flex items-center gap-2 self-start rounded-2xl border border-primary/40 bg-primary/5 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-primary transition hover:border-primary/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary/40 md:self-auto"
                        aria-label="Jump to the guests waiting for a reply"
                      >
                        <AlertTriangle className="h-3.5 w-3.5" /> Jump to waiting guests
                      </button>
                    ) : null}
                  </div>

                  {chatAttentionQueue.length ? (
                    <MessagesAttentionSummary
                      queue={chatAttentionQueue}
                      onSelectConversation={handleSelectConversation}
                      onEntryHandled={handleChatAttentionEntryHandled}
                      onClearAll={handleChatAttentionClearAll}
                      chatAttentionSnoozedUntil={chatAttentionSnoozedUntil}
                      chatAttentionPreferredSnoozeMinutes={chatAttentionPreferredSnoozeMinutes}
                      onChatAttentionSnooze={handleChatAttentionSnooze}
                      onChatAttentionResume={handleChatAttentionResume}
                    />
                  ) : null}

                  <div ref={conversationListWrapperRef} className="mt-5 rounded-2xl border border-border/50 bg-background/40 p-4">
                    <ConversationList
                      conversations={filteredConversations}
                      onSelectConversation={handleSelectConversation}
                      emptyState={emptyStateByFilter[statusFilter]}
                      emptyStateAction={emptyStateAction}
                      attentionQueue={chatAttentionQueue}
                      onAttentionEntryHandled={handleChatAttentionEntryHandled}
                      showDraftIndicators
                    />
                  </div>
                </section>

                <MessagesConversationPreview />
              </div>
            </div>
          </main>
        </div>
      </div>

      <MobileActionBar
        active="messages"
        onNavigateDiscover={handleDiscover}
        onNavigatePeople={handlePeople}
        onNavigateMessages={handleMessages}
        onCreate={handleCreate}
        onOpenProfile={handleProfile}
        canJumpToWaitingGuests={canJumpToWaitingGuests}
        onJumpToWaitingGuests={handleJumpToWaitingGuests}
        chatAttentionQueue={chatAttentionQueue}
        chatAttentionSnoozedUntil={chatAttentionSnoozedUntil}
        chatAttentionPreferredSnoozeMinutes={chatAttentionPreferredSnoozeMinutes}
        onChatAttentionEntryHandled={handleChatAttentionEntryHandled}
        onChatAttentionClearAll={handleChatAttentionClearAll}
        onChatAttentionSnooze={handleChatAttentionSnooze}
        onChatAttentionResume={handleChatAttentionResume}
      />
    </div>
  );
}

function MessagesMobileHero() {
  return (
    <div className="rounded-3xl border border-border/60 bg-card/60 px-5 py-4 text-foreground shadow-xl shadow-black/20 md:hidden">
      <p className="text-xs font-semibold uppercase tracking-wide text-primary">Tonight</p>
      <h1 className="mt-1 text-2xl font-serif font-semibold leading-tight">Messages</h1>
      <p className="text-xs text-muted-foreground">Your join requests and chats</p>
      <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-muted-foreground/80">
        <span className="inline-flex items-center gap-1 rounded-full border border-border/60 px-3 py-1">
          <MessageCircle className="h-3 w-3" />
          Accepted + pending
        </span>
        <span className="inline-flex items-center gap-1 rounded-full border border-border/60 px-3 py-1">
          <ShieldCheck className="h-3 w-3" />
          Safety tools on
        </span>
      </div>
    </div>
  );
}

function MessagesHero() {
  const cards = [
    {
      icon: MessageCircle,
      title: "Accepted chats",
      body: "Once a host approves you, the full conversation unlocks instantly with read receipts and typing states.",
    },
    {
      icon: Users,
      title: "Host + guest ready",
      body: "Both sides get the same timeline so plans stay in sync and quick nudges don't get missed.",
    },
    {
      icon: Sparkles,
      title: "Focus on tonight",
      body: "Everything here expires with the event so your inbox stays relevant to what's happening now.",
    },
  ];

  return (
    <section className="grid gap-3 md:grid-cols-3">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.title}
            className="rounded-2xl border border-border/60 bg-card/50 p-4 shadow-inner shadow-black/20"
          >
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Icon className="h-5 w-5" />
            </div>
            <p className="text-sm font-semibold text-foreground">{card.title}</p>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{card.body}</p>
          </div>
        );
      })}
    </section>
  );
}


function MessagesConversationPreview() {
  const featureConversation = PLACEHOLDER_CONVERSATIONS.find((conversation) => conversation.status === "accepted");
  const participantName = featureConversation?.participantName ?? "Elena K.";
  const eventTitle = featureConversation?.eventTitle ?? "Sushi Dinner";
  const eventCategory = featureConversation?.eventCategoryLabel ?? "Food";

  const transcript = [
    {
      id: "1",
      sender: "host" as const,
      name: "Maya (Host)",
      message: "Thanks for confirming! I grabbed a corner table so we can all hear each other.",
      timestamp: "Today • 5:21 PM",
    },
    {
      id: "2",
      sender: "you" as const,
      name: "You",
      message: "Love it. I’ll head over a little early so we can order snacks.",
      timestamp: "Today • 5:24 PM",
    },
    {
      id: "3",
      sender: "host" as const,
      name: "Maya (Host)",
      message: "Perfect — text if you get lost. The host stand has a neon lantern.",
      timestamp: "Today • 5:25 PM",
    },
    {
      id: "4",
      sender: "you" as const,
      name: "You",
      message: "On my way 🚕 should be there in ~10!",
      timestamp: "Today • 5:27 PM",
    },
  ];

  const badges = [
    {
      id: "host",
      title: "Host verified",
      description: "ID + trust tier locked in",
      accent: "from-emerald-500/20 via-emerald-500/5 to-transparent border-emerald-400/50",
    },
    {
      id: "guest",
      title: "Guests limited",
      description: "6 spots • room for two more",
      accent: "from-sky-500/20 via-sky-500/5 to-transparent border-sky-400/40",
    },
  ];

  return (
    <section className="rounded-3xl border border-border/60 bg-card/30 p-5 shadow-lg shadow-black/30">
      <div className="flex flex-col gap-4 border-b border-border/60 pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-border/60 bg-card/80 text-base font-semibold">
            {participantName
              .split(" ")
              .map((segment) => segment.charAt(0))
              .join("")}
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">{participantName}</p>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <MapPin className="h-3 w-3" /> {eventTitle}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 text-[11px] font-semibold uppercase tracking-wide">
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/40 bg-emerald-500/10 px-3 py-1 text-emerald-200">
            <BadgeCheck className="h-3 w-3" /> Accepted
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-background/60 px-3 py-1 text-muted-foreground">
            {eventCategory}
          </span>
        </div>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        {badges.map((badge) => (
          <div
            key={badge.id}
            className={classNames(
              "rounded-2xl border bg-gradient-to-br p-4",
              badge.accent,
              "shadow-inner shadow-black/10"
            )}
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-xs text-muted-foreground/80">
              {badge.id === "host" ? "Host" : "Capacity"}
            </p>
            <p className="mt-1 font-semibold text-foreground">{badge.title}</p>
            <p className="text-sm text-muted-foreground">{badge.description}</p>
          </div>
        ))}
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)]">
        <div className="space-y-3 rounded-2xl border border-border/50 bg-background/60 p-4">
          <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            <span>Preview thread</span>
            <span>Real chats unlock after approval</span>
          </div>
          <div className="space-y-3">
            {transcript.map((message) => (
              <div key={message.id} className={classNames("flex", message.sender === "you" ? "justify-end" : "justify-start")}>
                <div
                  className={classNames(
                    "max-w-[90%] rounded-2xl border px-4 py-3 text-sm leading-relaxed shadow",
                    message.sender === "you"
                      ? "border-primary/50 bg-primary text-primary-foreground/95"
                      : "border-border/60 bg-card/80 text-foreground"
                  )}
                >
                  <p className={classNames("text-[11px] font-semibold", message.sender === "you" ? "text-primary-foreground/80" : "text-muted-foreground/80")}>{message.name}</p>
                  <p className="mt-1 text-[13px] leading-relaxed">{message.message}</p>
                  <p className={classNames("mt-1 text-[10px]", message.sender === "you" ? "text-primary-foreground/70" : "text-muted-foreground/70")}>{message.timestamp}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-border/60 bg-card/50 p-4 shadow-inner shadow-black/10">
          <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-muted-foreground">Composer</p>
          <div className="mt-3 flex items-end gap-2">
            <textarea
              disabled
              rows={2}
              className="max-h-32 min-h-[72px] flex-1 resize-none rounded-2xl border border-border/60 bg-background/60 px-4 py-3 text-sm text-muted-foreground"
              placeholder="Messages unlock after the host accepts your request"
            />
            <button
              type="button"
              disabled
              className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-border text-muted-foreground"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Select any accepted chat from the list to open the full real-time experience with read receipts, host badges, and safety tools.
          </p>
          <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-muted-foreground/80">
            <span className="inline-flex items-center gap-1 rounded-full border border-border/60 px-3 py-1">
              <ShieldCheck className="h-3 w-3" /> Safety controls ready
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-border/60 px-3 py-1">
              <MessageCircle className="h-3 w-3" /> Typing states on
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}


type MessagesAttentionSummaryProps = {
  queue: EventChatAttentionPayload[];
  onSelectConversation: (conversationId: string) => void;
  onEntryHandled?: (entryId: string) => void;
  onClearAll?: () => void;
  chatAttentionSnoozedUntil?: string | null;
  chatAttentionPreferredSnoozeMinutes?: number | null;
  onChatAttentionSnooze?: (durationMinutes?: number) => void;
  onChatAttentionResume?: () => void;
};

export function MessagesAttentionSummary({
  queue,
  onSelectConversation,
  onEntryHandled,
  onClearAll,
  chatAttentionSnoozedUntil,
  chatAttentionPreferredSnoozeMinutes,
  onChatAttentionSnooze,
  onChatAttentionResume,
}: MessagesAttentionSummaryProps) {
  if (!Array.isArray(queue) || queue.length === 0) {
    return null;
  }

  const queueCountLabel = queue.length === 1 ? "1 chat awaiting a reply" : `${queue.length} chats awaiting replies`;

  return (
    <div className="mt-5 rounded-3xl border border-primary/30 bg-primary/5 p-4 text-primary shadow-inner shadow-black/5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-primary/70">Attention</p>
          <h3 className="font-serif text-xl font-semibold text-primary">Guests needing replies</h3>
          <p className="text-xs text-primary/80">{queueCountLabel}</p>
        </div>
        {onClearAll ? (
          <button
            type="button"
            onClick={onClearAll}
            className="inline-flex items-center gap-2 rounded-full border border-primary/40 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-primary transition hover:border-primary/60 hover:text-primary/90"
          >
            Mark all handled
          </button>
        ) : null}
      </div>
      <ul className="mt-4 space-y-3">
        {queue.map((entry) => (
          <MessagesAttentionEntry
            key={entry.id ?? `${entry.snippet}-${entry.timestampISO}`}
            entry={entry}
            onSelectConversation={onSelectConversation}
            onEntryHandled={onEntryHandled}
          />
        ))}
      </ul>
      <MessagesAttentionSnoozeControls
        chatAttentionSnoozedUntil={chatAttentionSnoozedUntil}
        chatAttentionPreferredSnoozeMinutes={chatAttentionPreferredSnoozeMinutes}
        onChatAttentionSnooze={onChatAttentionSnooze}
        onChatAttentionResume={onChatAttentionResume}
      />
    </div>
  );
}

type MessagesAttentionEntryProps = {
  entry: EventChatAttentionPayload;
  onSelectConversation: (conversationId: string) => void;
  onEntryHandled?: (entryId: string) => void;
};

function MessagesAttentionEntry({ entry, onSelectConversation, onEntryHandled }: MessagesAttentionEntryProps) {
  if (!entry?.id) {
    return null;
  }

  const label = entry.authorName ?? "Guest thread";
  const relativeLabel = formatRelativeTime(entry.timestampISO);
  const snippet = entry.snippet?.trim();

  return (
    <li className="rounded-2xl border border-primary/25 bg-background/80 p-4 shadow-sm shadow-primary/5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <AlertTriangle className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">{label}</p>
            {entry.helperText ? (
              <p className="text-[11px] font-semibold uppercase tracking-wide text-primary/80">{entry.helperText}</p>
            ) : null}
          </div>
        </div>
        <span className="text-[11px] font-semibold uppercase tracking-wide text-primary/70">{relativeLabel}</span>
      </div>
      {snippet ? <p className="mt-2 text-sm text-foreground/90">{snippet}</p> : null}
      <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-semibold uppercase tracking-wide">
        <button
          type="button"
          onClick={() => onSelectConversation(entry.id as string)}
          className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-primary transition hover:border-primary/50"
        >
          Open chat
        </button>
        {onEntryHandled ? (
          <button
            type="button"
            onClick={() => onEntryHandled(entry.id as string)}
            className="rounded-full border border-primary/30 px-3 py-1 text-primary/80 transition hover:border-primary/60"
          >
            Mark handled
          </button>
        ) : null}
      </div>
    </li>
  );
}

type MessagesAttentionSnoozeControlsProps = {
  chatAttentionSnoozedUntil?: string | null;
  chatAttentionPreferredSnoozeMinutes?: number | null;
  onChatAttentionSnooze?: (durationMinutes?: number) => void;
  onChatAttentionResume?: () => void;
};

function MessagesAttentionSnoozeControls({
  chatAttentionSnoozedUntil,
  chatAttentionPreferredSnoozeMinutes,
  onChatAttentionSnooze,
  onChatAttentionResume,
}: MessagesAttentionSnoozeControlsProps) {
  if (!onChatAttentionSnooze && !onChatAttentionResume) {
    return null;
  }

  const { isActive: chatAttentionIsSnoozed, label: chatAttentionSnoozeCountdownLabel } = useSnoozeCountdown(
    chatAttentionSnoozedUntil
  );
  const quickSnoozeMinutes = chatAttentionPreferredSnoozeMinutes ?? DEFAULT_CHAT_ATTENTION_SNOOZE_MINUTES;
  const quickSnoozeLabel = `Snooze for ${quickSnoozeMinutes} min`;
  const quickSnoozeAriaLabel = `Quick snooze chat attention alerts · ${quickSnoozeMinutes} min`;

  if (chatAttentionIsSnoozed) {
    return (
      <div className="mt-4 flex flex-wrap items-center gap-3 text-[10px] font-semibold uppercase tracking-wide text-primary">
        <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-primary">
          <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" aria-hidden />
          {chatAttentionSnoozeCountdownLabel ? `Snoozed · ${chatAttentionSnoozeCountdownLabel}` : "Snoozed"}
        </span>
        {onChatAttentionResume ? (
          <button
            type="button"
            onClick={onChatAttentionResume}
            className="text-primary/80 underline-offset-2 transition hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary/40"
          >
            Resume alerts
          </button>
        ) : null}
      </div>
    );
  }

  if (!onChatAttentionSnooze) {
    return null;
  }

  return (
    <div className="mt-4 flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-primary">
      <button
        type="button"
        onClick={() => onChatAttentionSnooze(quickSnoozeMinutes)}
        className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-primary transition hover:border-primary/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary/40"
        aria-label={quickSnoozeAriaLabel}
      >
        {quickSnoozeLabel}
      </button>
      <span className="text-primary/70">Snooze:</span>
      {CHAT_ATTENTION_SNOOZE_OPTIONS_MINUTES.map((minutes) => {
        const isPreferred = chatAttentionPreferredSnoozeMinutes === minutes;
        return (
          <button
            key={minutes}
            type="button"
            onClick={() => onChatAttentionSnooze(minutes)}
            className={classNames(
              "rounded-full border px-3 py-1 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary/40",
              isPreferred ? "border-primary/60 bg-primary/15 text-primary" : "border-primary/25 text-primary/80 hover:border-primary/50"
            )}
            aria-pressed={isPreferred}
            aria-label={`Snooze chat attention alerts for ${minutes} minutes`}
          >
            {minutes} min
          </button>
        );
      })}
    </div>
  );
}
