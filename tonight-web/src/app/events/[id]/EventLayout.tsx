"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { DesktopSidebar } from "@/components/tonight/DesktopSidebar";
import { DesktopHeader } from "@/components/tonight/DesktopHeader";
import { MobileActionBar, type MobileActionBarProps } from "@/components/tonight/MobileActionBar";
import { EventChatAttentionToast } from "@/components/tonight/EventChatAttentionToast";
import type { EventChatAttentionPayload } from "@/components/tonight/event-inside/EventInsideExperience";
import type { CategoryId } from "@/lib/categories";

type EventLayoutProps = {
  children: React.ReactNode;
  eventTitle: string;
  eventLocation: string;
  userDisplayName: string | null;
  userEmail: string | null;
  userPhotoUrl: string | null;
  chatAction?: MobileActionBarProps['chatAction'];
  chatAttentionQueue?: EventChatAttentionPayload[];
  onChatAttentionEntryHandled?: (entryId: string) => void;
};

export function EventLayout({
  children,
  eventTitle,
  eventLocation,
  userDisplayName,
  userEmail,
  userPhotoUrl,
  chatAction,
  chatAttentionQueue,
  onChatAttentionEntryHandled,
}: EventLayoutProps) {
  const router = useRouter();
  const [selectedCategory, setSelectedCategory] = useState<CategoryId | null>(null);
  const showChatAttentionToast = Boolean(chatAction?.attentionActive && chatAction?.href && chatAttentionQueue?.length);

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <div className="flex min-h-dvh flex-col md:flex-row">
        <DesktopSidebar
          selectedCategory={selectedCategory}
          onCategoryChange={setSelectedCategory}
          onCreate={() => router.push('/events/create')}
          onNavigateDiscover={() => router.push('/')}
          onNavigatePeople={() => router.push('/people')}
          onNavigateMessages={() => router.push('/messages')}
          activePrimaryNav={null}
        />

        <div className="flex flex-1 flex-col">
          <DesktopHeader
            title={eventTitle}
            subtitle={eventLocation}
            onNavigateProfile={() => router.push('/profile')}
            onNavigateMessages={() => router.push('/messages')}
            userDisplayName={userDisplayName}
            userEmail={userEmail}
            userPhotoUrl={userPhotoUrl}
            chatAction={chatAction}
            chatAttentionQueue={chatAttentionQueue}
          />

          <main className="flex-1 overflow-y-auto px-4 pb-28 pt-4 md:px-10 md:pb-12 md:pt-8">
            {children}
          </main>
        </div>
      </div>

      {showChatAttentionToast ? (
        <EventChatAttentionToast
          href={chatAction!.href}
          label={chatAction!.label}
          helperText={chatAction?.helperText}
          attentionLabel={chatAction?.attentionLabel}
          snippet={chatAction?.lastMessageSnippet}
          snippetSender={chatAction?.lastMessageAuthorName}
          snippetTimestamp={chatAction?.lastMessageAtISO}
          onInteract={chatAction?.onInteract}
          attentionQueue={chatAttentionQueue}
          onMarkHandled={onChatAttentionEntryHandled}
        />
      ) : null}

      <MobileActionBar
        active={null}
        onNavigateDiscover={() => router.push('/')}
        onNavigatePeople={() => router.push('/people')}
        onNavigateMessages={() => router.push('/messages')}
        onCreate={() => router.push('/events/create')}
        onOpenProfile={() => router.push('/profile')}
        chatAction={chatAction}
        chatAttentionQueue={chatAttentionQueue}
      />
    </div>
  );
}
