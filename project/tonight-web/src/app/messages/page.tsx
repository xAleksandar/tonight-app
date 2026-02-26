"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { ConversationList } from "@/components/chat/ConversationList";
import { type ConversationPreview } from "@/components/chat/conversations";
import { AuthStatusMessage } from "@/components/auth/AuthStatusMessage";
import type { AuthUser } from "@/components/auth/AuthProvider";
import { DesktopHeader } from "@/components/tonight/DesktopHeader";
import { DesktopSidebar } from "@/components/tonight/DesktopSidebar";
import { MobileActionBar } from "@/components/tonight/MobileActionBar";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { useSocket } from "@/hooks/useSocket";
import type { CategoryId } from "@/lib/categories";
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

function AuthenticatedMessagesPage({ currentUser }: { currentUser: AuthUser | null }) {
  const router = useRouter();
  const [conversations, setConversations] = useState<ConversationPreview[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sidebarCategory, setSidebarCategory] = useState<CategoryId | null>(null);

  const fetchConversations = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/conversations");
      if (!response.ok) return;
      const data = await response.json();
      setConversations(data.conversations ?? []);
    } catch {
      // Silently ignore
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (currentUser) {
      fetchConversations();
    }
  }, [currentUser, fetchConversations]);

  const handleMessage = useCallback(
    (payload: SocketMessagePayload) => {
      setConversations((prev) =>
        prev.map((conv) => {
          if (conv.id !== payload.joinRequestId) return conv;
          return {
            ...conv,
            messageSnippet: payload.content,
            updatedAtLabel: "Just now",
            unreadCount:
              payload.senderId !== currentUser?.id
                ? (conv.unreadCount ?? 0) + 1
                : (conv.unreadCount ?? 0),
          };
        })
      );
    },
    [currentUser?.id]
  );

  useSocket({ token: null, autoConnect: true, onMessage: handleMessage });

  const handleSelectConversation = useCallback(
    (conversationId: string) => {
      router.push(`/chat/${conversationId}`);
    },
    [router]
  );

  const unreadMessageCount = useMemo(
    () => conversations.reduce((total, conversation) => total + (conversation.unreadCount ?? 0), 0),
    [conversations]
  );

  return (
    <div className="min-h-dvh text-foreground">
      <div className="flex min-h-dvh flex-col md:flex-row">
        <DesktopSidebar
          selectedCategory={sidebarCategory}
          onCategoryChange={setSidebarCategory}
          onCreate={() => router.push("/events/create")}
          onNavigateDiscover={() => router.push("/")}
          onNavigatePeople={() => router.push("/people")}
          onNavigateMessages={() => router.push("/messages")}
          activePrimaryNav="messages"
        />

        <div className="flex flex-1 flex-col">
          <DesktopHeader
            title="Messages"
            subtitle="Keep the conversation going"
            onNavigateProfile={() => router.push("/profile")}
            onNavigateMessages={() => router.push("/messages")}
            unreadCount={unreadMessageCount}
            userDisplayName={currentUser?.displayName ?? null}
            userEmail={currentUser?.email ?? null}
            userPhotoUrl={currentUser?.photoUrl ?? null}
          />

          <main className="flex-1 px-4 pb-28 pt-4 md:px-10 md:pb-12 md:pt-8">
            <div className="mx-auto w-full max-w-2xl">
              <h1 className="mb-6 text-2xl font-bold tracking-tight text-foreground md:hidden">Messages</h1>
              {isLoading ? (
                <div className="space-y-2">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="h-20 animate-pulse rounded-2xl bg-white/5" />
                  ))}
                </div>
              ) : (
                <ConversationList
                  conversations={conversations}
                  onSelectConversation={handleSelectConversation}
                  showDraftIndicators
                />
              )}
            </div>
          </main>
        </div>
      </div>

      <MobileActionBar
        active="messages"
        onNavigateDiscover={() => router.push("/")}
        onNavigatePeople={() => router.push("/people")}
        onNavigateMessages={() => router.push("/messages")}
        onCreate={() => router.push("/events/create")}
        onOpenProfile={() => router.push("/profile")}
        messagesUnreadCount={unreadMessageCount}
      />
    </div>
  );
}
