"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EventLayout } from "./EventLayout";
import type { EventChatAttentionPayload, EventInsideExperienceProps } from "@/components/tonight/event-inside/EventInsideExperience";
import { EventInsideExperience } from "@/components/tonight/event-inside/EventInsideExperience";
import { buildMobileChatAction } from "@/lib/buildMobileChatAction";
import { buildChatAttentionLabels } from "@/lib/buildChatAttentionLabels";
import { showSuccessToast } from "@/lib/toast";

const CHAT_ATTENTION_SNOOZE_DURATION_MS = 5 * 60 * 1000;

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
  const [chatAttentionSnoozedUntil, setChatAttentionSnoozedUntil] = useState<string | null>(null);
  const chatAttentionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const chatAttentionSnoozeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const chatAttentionQueueRef = useRef<EventChatAttentionPayload[]>([]);
  const isChatAttentionSnoozed = useMemo(() => {
    if (!chatAttentionSnoozedUntil) {
      return false;
    }
    const timestamp = Date.parse(chatAttentionSnoozedUntil);
    return Number.isNaN(timestamp) ? false : timestamp > Date.now();
  }, [chatAttentionSnoozedUntil]);
  const chatAttentionLabels = useMemo(() => buildChatAttentionLabels(chatAttentionQueue), [chatAttentionQueue]);
  const chatAttentionTotalCount = chatAttentionLabels.leadEntry ? chatAttentionLabels.waitingCount + 1 : chatAttentionLabels.waitingCount;

  useEffect(() => {
    chatAttentionQueueRef.current = chatAttentionQueue;
  }, [chatAttentionQueue]);

  const startAttentionTimeout = useCallback(
    (queueLength = 1) => {
      if (queueLength <= 0 || isChatAttentionSnoozed) {
        return;
      }

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
    },
    [isChatAttentionSnoozed]
  );

  const clearSnoozeTimeout = useCallback(() => {
    if (chatAttentionSnoozeTimeoutRef.current) {
      clearTimeout(chatAttentionSnoozeTimeoutRef.current);
      chatAttentionSnoozeTimeoutRef.current = null;
    }
  }, []);

  const scheduleSnoozeWake = useCallback(
    (targetISO: string | null) => {
      clearSnoozeTimeout();
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
        if (chatAttentionQueueRef.current.length > 0) {
          setChatAttentionActive(true);
          startAttentionTimeout(chatAttentionQueueRef.current.length);
          showSuccessToast("Chat alerts resumed", "We'll keep nudging you while guests wait.");
        }
      }, delay);
    },
    [clearSnoozeTimeout, startAttentionTimeout, showSuccessToast]
  );

  const clearChatAttention = useCallback(() => {
    setChatAttentionActive(false);
    setChatAttentionQueue([]);
    setChatAttentionSnoozedUntil(null);
    clearSnoozeTimeout();
    if (chatAttentionTimeoutRef.current) {
      clearTimeout(chatAttentionTimeoutRef.current);
      chatAttentionTimeoutRef.current = null;
    }
  }, [clearSnoozeTimeout]);

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
        if (!isChatAttentionSnoozed) {
          setChatAttentionActive(true);
        }
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
            if (!isChatAttentionSnoozed) {
              startAttentionTimeout(next.length);
            }
            return next;
          });
        } else if (!isChatAttentionSnoozed) {
          startAttentionTimeout(Math.max(chatAttentionQueue.length, 1));
        }
        return;
      }
      clearChatAttention();
    },
    [chatAttentionQueue.length, clearChatAttention, isChatAttentionSnoozed, startAttentionTimeout]
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
          setChatAttentionSnoozedUntil(null);
          clearSnoozeTimeout();
          if (chatAttentionTimeoutRef.current) {
            clearTimeout(chatAttentionTimeoutRef.current);
            chatAttentionTimeoutRef.current = null;
          }
          return next;
        }

        if (!isChatAttentionSnoozed) {
          setChatAttentionActive(true);
          startAttentionTimeout(next.length);
        }
        return next;
      });
    },
    [clearSnoozeTimeout, isChatAttentionSnoozed, startAttentionTimeout]
  );

  const handleChatAttentionSnooze = useCallback(() => {
    const snoozeUntil = new Date(Date.now() + CHAT_ATTENTION_SNOOZE_DURATION_MS).toISOString();
    setChatAttentionSnoozedUntil(snoozeUntil);
    setChatAttentionActive(false);
    if (chatAttentionTimeoutRef.current) {
      clearTimeout(chatAttentionTimeoutRef.current);
      chatAttentionTimeoutRef.current = null;
    }
    showSuccessToast("Chat alerts snoozed", "We'll remind you again in about 5 minutes.");
    scheduleSnoozeWake(snoozeUntil);
  }, [scheduleSnoozeWake, showSuccessToast]);

  const handleChatAttentionResume = useCallback(() => {
    if (!chatAttentionSnoozedUntil) {
      return;
    }

    clearSnoozeTimeout();
    setChatAttentionSnoozedUntil(null);
    if (chatAttentionQueueRef.current.length > 0) {
      setChatAttentionActive(true);
      startAttentionTimeout(chatAttentionQueueRef.current.length);
      showSuccessToast("Chat alerts back on", "We'll resume nudges for the guests who pinged.");
    } else {
      showSuccessToast("Chat alerts back on", "We'll ping you again when someone reaches out.");
    }
  }, [chatAttentionSnoozedUntil, clearSnoozeTimeout, showSuccessToast, startAttentionTimeout]);

  useEffect(() => {
    return () => {
      if (chatAttentionTimeoutRef.current) {
        clearTimeout(chatAttentionTimeoutRef.current);
      }
      if (chatAttentionSnoozeTimeoutRef.current) {
        clearTimeout(chatAttentionSnoozeTimeoutRef.current);
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
      chatAttentionSnoozedUntil={chatAttentionSnoozedUntil}
      onChatAttentionEntryHandled={handleChatAttentionEntryHandled}
      onChatAttentionClearAll={handleChatAttentionClearAll}
      onChatAttentionSnooze={handleChatAttentionSnooze}
      onChatAttentionResume={handleChatAttentionResume}
    >
      <EventInsideExperience
        {...experience}
        onChatPreviewRefresh={handleChatPreviewRefresh}
        chatAttentionActive={chatAttentionActive}
        chatAttentionQueue={chatAttentionQueue}
        chatAttentionSnoozedUntil={chatAttentionSnoozedUntil}
        onChatAttentionChange={handleChatAttentionChange}
        onChatAttentionEntryHandled={handleChatAttentionEntryHandled}
        onChatAttentionClearAll={handleChatAttentionClearAll}
        onChatAttentionSnooze={handleChatAttentionSnooze}
        onChatAttentionResume={handleChatAttentionResume}
      />
    </EventLayout>
  );
}
