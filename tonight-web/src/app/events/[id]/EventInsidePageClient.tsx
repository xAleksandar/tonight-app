"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EventLayout } from "./EventLayout";
import type { EventChatAttentionPayload, EventInsideExperienceProps } from "@/components/tonight/event-inside/EventInsideExperience";
import { EventInsideExperience } from "@/components/tonight/event-inside/EventInsideExperience";
import { buildMobileChatAction } from "@/lib/buildMobileChatAction";
import { buildChatAttentionLabels } from "@/lib/buildChatAttentionLabels";
import { showSuccessToast } from "@/lib/toast";

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
  const chatAttentionLabels = useMemo(() => buildChatAttentionLabels(chatAttentionQueue), [chatAttentionQueue]);
  const chatAttentionTotalCount = chatAttentionLabels.leadEntry ? chatAttentionLabels.waitingCount + 1 : chatAttentionLabels.waitingCount;

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

  const handleChatAttentionClearAll = useCallback(() => {
    const queueLength = chatAttentionQueue.length;
    if (queueLength === 0) {
      return;
    }

    const confirmMessage = queueLength === 1
      ? "Mark the current chat ping as handled? This will clear the live attention alert."
      : `Mark all ${queueLength} chat pings as handled? This will clear every live attention alert.`;

    const confirmed = typeof window === "undefined" ? true : window.confirm(confirmMessage);
    if (!confirmed) {
      return;
    }

    clearChatAttention();

    const helperCopy = queueLength === 1
      ? "Cleared the pending attention alert."
      : `Cleared ${queueLength} queued attention alerts.`;
    showSuccessToast("Attention cleared", helperCopy);
  }, [chatAttentionQueue.length, clearChatAttention]);

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

  const handleChatAttentionEntryHandled = useCallback(
    (entryId: string) => {
      if (!entryId) {
        return;
      }

      setChatAttentionQueue((prev) => {
        const next = prev.filter((entry) => entry.id !== entryId);
        if (next.length === prev.length) {
          return prev;
        }

        if (next.length === 0) {
          setChatAttentionActive(false);
          if (chatAttentionTimeoutRef.current) {
            clearTimeout(chatAttentionTimeoutRef.current);
            chatAttentionTimeoutRef.current = null;
          }
          return next;
        }

        setChatAttentionActive(true);
        startAttentionTimeout(next.length);
        return next;
      });
    },
    [startAttentionTimeout]
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
        attentionLabel: chatAttentionLabels.indicatorLabel,
        attentionSourceLabel: chatAttentionLabels.leadLabel,
        attentionQueueLabel: chatAttentionLabels.waitingLabel,
        attentionQueueCount: chatAttentionTotalCount,
        onInteract: clearChatAttention,
      }),
    [
      experience.viewerRole,
      latestChatPreview,
      chatAttentionActive,
      chatAttentionLabels.indicatorLabel,
      chatAttentionLabels.leadLabel,
      chatAttentionLabels.waitingLabel,
      chatAttentionTotalCount,
      clearChatAttention,
    ]
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
      onChatAttentionEntryHandled={handleChatAttentionEntryHandled}
      onChatAttentionClearAll={handleChatAttentionClearAll}
    >
      <EventInsideExperience
        {...experience}
        onChatPreviewRefresh={handleChatPreviewRefresh}
        chatAttentionActive={chatAttentionActive}
        chatAttentionQueue={chatAttentionQueue}
        onChatAttentionChange={handleChatAttentionChange}
        onChatAttentionEntryHandled={handleChatAttentionEntryHandled}
        onChatAttentionClearAll={handleChatAttentionClearAll}
      />
    </EventLayout>
  );
}
