"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, MapPin, MessageCircle, Send, ShieldCheck, Sparkles, Users } from "lucide-react";

import { ConversationList } from "@/components/chat/ConversationList";
import { PLACEHOLDER_CONVERSATIONS, hasPlaceholderConversationData, type ConversationPreview } from "@/components/chat/conversations";
import { AuthStatusMessage } from "@/components/auth/AuthStatusMessage";
import type { AuthUser } from "@/components/auth/AuthProvider";
import { DesktopHeader } from "@/components/tonight/DesktopHeader";
import { DesktopSidebar } from "@/components/tonight/DesktopSidebar";
import { MobileActionBar } from "@/components/tonight/MobileActionBar";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import type { CategoryId } from "@/lib/categories";
import { classNames } from "@/lib/classNames";

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

type ConversationFilter = "all" | "accepted" | "pending";

function AuthenticatedMessagesPage({ currentUser }: { currentUser: AuthUser | null }) {
  const router = useRouter();
  const [selectedCategory, setSelectedCategory] = useState<CategoryId | null>(null);
  const [conversations] = useState<ConversationPreview[]>(PLACEHOLDER_CONVERSATIONS);
  const [statusFilter, setStatusFilter] = useState<ConversationFilter>("all");

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

  const filteredConversations = useMemo(() => {
    if (statusFilter === "all") {
      return conversations;
    }
    return conversations.filter((conversation) => conversation.status === statusFilter);
  }, [conversations, statusFilter]);

  const handleSelectConversation = useCallback(
    (conversationId: string) => {
      if (conversationId.startsWith("demo-")) {
        return;
      }
      router.push(`/chat/${conversationId}`);
    },
    [router]
  );

  const handleCreate = useCallback(() => router.push("/events/create"), [router]);
  const handleDiscover = useCallback(() => router.push("/"), [router]);
  const handlePeople = useCallback(() => router.push("/people"), [router]);
  const handleProfile = useCallback(() => router.push("/profile"), [router]);
  const handleMessages = useCallback(() => router.push("/messages"), [router]);

  const headline = hasOnlyPlaceholders ? "You're all caught up" : "Latest conversations";

  const filterOptions = useMemo(
    () => [
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
    ],
    [filterCounts]
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
          />

          <main className="flex-1 px-4 pb-28 pt-4 md:px-10 md:pb-12 md:pt-8">
            <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
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

                  <div className="mt-4 flex flex-wrap gap-2">
                    {filterOptions.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setStatusFilter(option.id)}
                        className={classNames(
                          "inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-semibold uppercase tracking-wide transition",
                          statusFilter === option.id
                            ? "border-primary/50 bg-primary/10 text-primary"
                            : "border-border/60 text-muted-foreground hover:text-foreground"
                        )}
                        aria-pressed={statusFilter === option.id}
                      >
                        <span>{option.label}</span>
                        <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-foreground/80">
                          {option.count}
                        </span>
                      </button>
                    ))}
                  </div>

                  <div className="mt-5 rounded-2xl border border-border/50 bg-background/40 p-4">
                    <ConversationList
                      conversations={filteredConversations}
                      onSelectConversation={handleSelectConversation}
                      emptyState={emptyStateByFilter[statusFilter]}
                      emptyStateAction={emptyStateAction}
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
      />
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
