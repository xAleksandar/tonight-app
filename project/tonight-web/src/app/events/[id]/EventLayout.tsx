"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { DesktopSidebar } from "@/components/tonight/DesktopSidebar";
import { DesktopHeader } from "@/components/tonight/DesktopHeader";
import { type MobileActionBarProps } from "@/components/tonight/MobileActionBar";
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
  chatAttentionSnoozedUntil?: string | null;
  chatAttentionPreferredSnoozeMinutes?: number | null;
  onChatAttentionEntryHandled?: (entryId: string) => void;
  onChatAttentionClearAll?: () => void;
  onChatAttentionSnooze?: (durationMinutes?: number) => void;
  onChatAttentionResume?: () => void;
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
  chatAttentionSnoozedUntil,
  chatAttentionPreferredSnoozeMinutes,
  onChatAttentionEntryHandled,
  onChatAttentionClearAll,
  onChatAttentionSnooze,
  onChatAttentionResume,
}: EventLayoutProps) {
  const router = useRouter();
  const [selectedCategory, setSelectedCategory] = useState<CategoryId | null>(null);
  const showChatAttentionToast = Boolean(
    chatAction?.href &&
    chatAttentionQueue?.length &&
    (chatAction?.attentionActive || chatAttentionSnoozedUntil)
  );

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
          {/* Mobile header — back arrow + event title */}
          <div className="sticky top-0 z-10 flex shrink-0 items-center gap-3 border-b border-border/60 bg-background/90 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+12px)] backdrop-blur-lg md:hidden">
            <button
              type="button"
              onClick={() => router.back()}
              aria-label="Back"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border/60 bg-card/60 text-muted-foreground transition hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="flex flex-1 flex-col overflow-hidden">
              <p className="truncate text-base font-semibold text-foreground">{eventTitle}</p>
              {eventLocation && (
                <p className="truncate text-xs text-muted-foreground">{eventLocation}</p>
              )}
            </div>
          </div>

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
            chatAttentionSnoozedUntil={chatAttentionSnoozedUntil}
            chatAttentionPreferredSnoozeMinutes={chatAttentionPreferredSnoozeMinutes}
            onChatAttentionEntryHandled={onChatAttentionEntryHandled}
            onChatAttentionClearAll={onChatAttentionClearAll}
            onChatAttentionSnooze={onChatAttentionSnooze}
            onChatAttentionResume={onChatAttentionResume}
          />

          <main className="flex-1 overflow-y-auto px-4 pb-8 pt-4 md:px-10 md:pb-12 md:pt-8">
            <div className="mx-auto w-full max-w-[1344px]">
              {children}
            </div>
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
          chatAttentionSnoozedUntil={chatAttentionSnoozedUntil}
          chatAttentionPreferredSnoozeMinutes={chatAttentionPreferredSnoozeMinutes}
          onMarkHandled={onChatAttentionEntryHandled}
          onMarkAllHandled={onChatAttentionClearAll}
          onSnooze={onChatAttentionSnooze}
          onResume={onChatAttentionResume}
        />
      ) : null}

    </div>
  );
}
