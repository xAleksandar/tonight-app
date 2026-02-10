"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { MessageCircle, Sparkles, Users } from "lucide-react";

import { ConversationList } from "@/components/chat/ConversationList";
import { PLACEHOLDER_CONVERSATIONS, hasPlaceholderConversationData, type ConversationPreview } from "@/components/chat/conversations";
import { AuthStatusMessage } from "@/components/auth/AuthStatusMessage";
import { DesktopHeader } from "@/components/tonight/DesktopHeader";
import { DesktopSidebar } from "@/components/tonight/DesktopSidebar";
import { MobileActionBar } from "@/components/tonight/MobileActionBar";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import type { CategoryId } from "@/lib/categories";

export default function MessagesPage() {
  const { status } = useRequireAuth();

  if (status === "loading") {
    return <AuthStatusMessage label="Checking your session…" />;
  }

  if (status === "unauthenticated") {
    return <AuthStatusMessage label="Redirecting you to the welcome screen…" />;
  }

  if (status === "error") {
    return <AuthStatusMessage label="We couldn't verify your session. Refresh to try again." />;
  }

  return <AuthenticatedMessagesPage />;
}

function AuthenticatedMessagesPage() {
  const router = useRouter();
  const [selectedCategory, setSelectedCategory] = useState<CategoryId | null>(null);
  const [conversations] = useState<ConversationPreview[]>(PLACEHOLDER_CONVERSATIONS);

  const hasOnlyPlaceholders = useMemo(() => hasPlaceholderConversationData(conversations), [conversations]);

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

  return (
    <div className="min-h-dvh bg-gradient-to-b from-[#05070f] via-[#05060d] to-[#04040a] text-foreground">
      <div className="flex min-h-dvh flex-col md:flex-row">
        <DesktopSidebar
          selectedCategory={selectedCategory}
          onCategoryChange={setSelectedCategory}
          onCreate={handleCreate}
          onNavigateDiscover={handleDiscover}
          onNavigatePeople={handlePeople}
          activePrimaryNav={null}
        />

        <div className="flex flex-1 flex-col">
          <DesktopHeader
            title="Messages"
            subtitle="Keep pace with the hosts and guests you've matched with"
            onNavigateProfile={handleProfile}
            onNavigateMessages={handleMessages}
          />

          <main className="flex-1 px-4 pb-28 pt-4 md:px-10 md:pb-12 md:pt-8">
            <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
              <MessagesHero />

              <section className="rounded-3xl border border-border/60 bg-card/40 p-5 shadow-lg shadow-black/30">
                <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-primary/80">Tonight</p>
                    <h2 className="font-serif text-2xl font-semibold leading-snug">{headline}</h2>
                    <p className="text-sm text-muted-foreground">Accepted requests open the full chat. Pending ones stay here until a host approves you.</p>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground/80">
                    <span className="inline-flex items-center gap-1 rounded-full border border-border/60 px-3 py-1">Auto-refreshing</span>
                    <span className="inline-flex items-center gap-1 rounded-full border border-border/60 px-3 py-1">Secure & private</span>
                  </div>
                </div>

                <div className="mt-5 rounded-2xl border border-border/50 bg-background/40 p-4">
                  <ConversationList conversations={conversations} onSelectConversation={handleSelectConversation} />
                </div>
              </section>
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
