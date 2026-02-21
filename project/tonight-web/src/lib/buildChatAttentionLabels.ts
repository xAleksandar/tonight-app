import type { EventChatAttentionPayload } from "@/components/tonight/event-inside/EventInsideExperience";

export type ChatAttentionLabels = {
  leadEntry: EventChatAttentionPayload | null;
  leadLabel: string | null;
  waitingLabel: string | null;
  waitingCount: number;
  indicatorLabel: string | null;
};

const formatWaitingLabel = (waitingCount: number): string | null => {
  if (waitingCount <= 0) {
    return null;
  }
  return waitingCount === 1 ? "1 more waiting" : `${waitingCount} more waiting`;
};

const formatLeadLabel = (entry: EventChatAttentionPayload | null): string | null => {
  if (!entry) {
    return null;
  }
  const trimmedAuthor = entry.authorName?.trim();
  if (trimmedAuthor && trimmedAuthor.length > 0) {
    return `${trimmedAuthor} pinged`;
  }
  const trimmedHelper = entry.helperText?.trim();
  if (trimmedHelper && trimmedHelper.length > 0) {
    return trimmedHelper;
  }
  return "New chat ping";
};

export const buildChatAttentionLabels = (
  queue?: Array<EventChatAttentionPayload | null> | null
): ChatAttentionLabels => {
  const normalized = Array.isArray(queue)
    ? queue.filter((entry): entry is EventChatAttentionPayload => Boolean(entry && entry.id))
    : [];

  const leadEntry = normalized.length > 0 ? normalized[0] : null;
  const waitingCount = normalized.length > 1 ? normalized.length - 1 : 0;

  const leadLabel = formatLeadLabel(leadEntry);
  const waitingLabel = formatWaitingLabel(waitingCount);

  let indicatorLabel: string | null = null;
  if (leadLabel) {
    indicatorLabel = waitingCount > 0 ? `${leadLabel} · +${waitingCount} waiting` : leadLabel;
  } else {
    indicatorLabel = waitingLabel;
  }

  return {
    leadEntry,
    leadLabel,
    waitingLabel,
    waitingCount,
    indicatorLabel,
  };
};
