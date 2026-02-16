"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EventLayout } from "./EventLayout";
import type { EventChatAttentionPayload, EventInsideExperienceProps } from "@/components/tonight/event-inside/EventInsideExperience";
import { EventInsideExperience } from "@/components/tonight/event-inside/EventInsideExperience";
import { buildMobileChatAction } from "@/lib/buildMobileChatAction";

import type { MobileActionBarProps } from "@/components/tonight/MobileActionBar";

type EventInsidePageClientProps = {
  experience: EventInsideExperienceProps;
  layoutProps: {
    eventTitle: string;
    eventLocation: string;
    userDisplayName: string | null;
    userEmail: string | null;
    userPhotoUrl: string | null;
  };
};

export function EventInsidePageClient({ experience, layoutProps }: EventInsidePageClientProps) {
  const [latestChatPreview, setLatestChatPreview] = useState<EventInsideExperienceProps["chatPreview"]>(
    experience.chatPreview
  );
  const [chatAttentionActive, setChatAttentionActive] = useState(false);
  const [chatAttentionQueue, setChatAttentionQueue] = useState<EventChatAttentionPayload[]>([]);
  const chatAttentionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const startAttentionTimeout = useCallback((queueLength = 1) => {
    const baseDuration = 10_000;
    const extraPerItem = 3_500;
    const extraItems = Math.max(Math.min(queueLength - 1, 4), 0);
    const duration = baseDuration + extraItems * extraPerItem;

    if (chatAttentionTimeoutRef.current) {
      clearTimeout(chatAttentionTimeoutRef.current);
    }

    chatAttentionTimeoutRef.current = setTimeout(() => {
      setChatAttentionActive(false);
      setChatAttentionQueue([]);
      chatAttentionTimeoutRef.current = null;
    }, duration);
  }, []);

  const clearChatAttention = useCallback(() => {
    setChatAttentionActive(false);
    setChatAttentionQueue([]);
    if (chatAttentionTimeoutRef.current) {
      clearTimeout(chatAttentionTimeoutRef.current);
      chatAttentionTimeoutRef.current = null;
    }
  }, []);

  const handleChatAttentionChange = useCallback(
    (active: boolean, payload?: EventChatAttentionPayload) => {
      if (active) {
        setChatAttentionActive(true);
        if (payload) {
          setChatAttentionQueue((prev) => {
            const existingIndex = prev.findIndex((entry) => entry.id === payload.id);
            let next: EventChatAttentionPayload[];
            if (existingIndex >= 0) {
              next = [...prev];
              next[existingIndex] = { ...next[existingIndex], ...payload };
            } else {
              next = [...prev, payload];
            }
            startAttentionTimeout(next.length);
            return next;
          });
        } else {
          startAttentionTimeout(Math.max(chatAttentionQueue.length, 1));
        }
        return;
      }
      clearChatAttention();
    },
    [chatAttentionQueue.length, clearChatAttention, startAttentionTimeout]
  );

  useEffect(() => {
    return () => {
      if (chatAttentionTimeoutRef.current) {
        clearTimeout(chatAttentionTimeoutRef.current);
      }
    };
  }, []);

  const handleChatPreviewRefresh = useCallback(
    (nextPreview: EventInsideExperienceProps["chatPreview"] | undefined) => {
      setLatestChatPreview(nextPreview ?? experience.chatPreview);
    },
    [experience.chatPreview]
  );

  useEffect(() => {
    setLatestChatPreview(experience.chatPreview);
  }, [experience.chatPreview]);

  const chatAction: MobileActionBarProps["chatAction"] = useMemo(
    () =>
      buildMobileChatAction(experience.viewerRole, latestChatPreview, {
        attentionActive: chatAttentionActive,
        onInteract: clearChatAttention,
      }),
    [experience.viewerRole, latestChatPreview, chatAttentionActive, clearChatAttention]
  );

  return (
    <EventLayout
      eventTitle={layoutProps.eventTitle}
      eventLocation={layoutProps.eventLocation}
      userDisplayName={layoutProps.userDisplayName}
      userEmail={layoutProps.userEmail}
      userPhotoUrl={layoutProps.userPhotoUrl}
      chatAction={chatAction}
      chatAttentionQueue={chatAttentionQueue}
    >
      <EventInsideExperience
        {...experience}
        onChatPreviewRefresh={handleChatPreviewRefresh}
        chatAttentionActive={chatAttentionActive}
        onChatAttentionChange={handleChatAttentionChange}
      />
    </EventLayout>
  );
}
