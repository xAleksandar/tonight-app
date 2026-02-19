import { describe, expect, it } from "vitest";

import { buildMessagesFilterAttentionCounts, findMessagesAttentionJumpTarget } from "@/app/messages/page";
import type { EventChatAttentionPayload } from "@/components/tonight/event-inside/EventInsideExperience";
import type { ConversationPreview } from "@/components/chat/conversations";

describe("buildMessagesFilterAttentionCounts", () => {
  const baseConversations: Pick<ConversationPreview, "id" | "status">[] = [
    { id: "jr_accepted", status: "accepted" },
    { id: "jr_pending", status: "pending" },
  ];

  const buildQueue = (ids: string[]): EventChatAttentionPayload[] =>
    ids.map((id, index) => ({
      id,
      snippet: `Message ${index}`,
    }));

  it("counts queued guests per filter", () => {
    const queue = buildQueue(["jr_accepted", "jr_pending", "jr_accepted"]);
    const counts = buildMessagesFilterAttentionCounts(baseConversations, queue);

    expect(counts).toEqual({
      all: 3,
      accepted: 2,
      pending: 1,
    });
  });

  it("falls back to the all bucket when a conversation is missing", () => {
    const queue = buildQueue(["jr_unknown"]);
    const counts = buildMessagesFilterAttentionCounts(baseConversations, queue);

    expect(counts).toEqual({
      all: 1,
      accepted: 0,
      pending: 0,
    });
  });
});

describe("findMessagesAttentionJumpTarget", () => {
  const baseConversations: ConversationPreview[] = [
    {
      id: "jr-accepted",
      participantName: "Nina L.",
      eventTitle: "Midnight Jazz",
      messageSnippet: "See you soon",
      updatedAtLabel: "Just now",
      status: "accepted",
    },
    {
      id: "jr-pending",
      participantName: "Marco R.",
      eventTitle: "Gallery Tour",
      messageSnippet: "Pending",
      updatedAtLabel: "3 min ago",
      status: "pending",
    },
  ];

  const buildQueueEntry = (id?: string): EventChatAttentionPayload => ({
    id,
    snippet: `Message for ${id ?? "unknown"}`,
  });

  it("returns the first queue entry that exists in the conversation list", () => {
    const queue = [buildQueueEntry(undefined), buildQueueEntry("jr-pending"), buildQueueEntry("jr-accepted")];
    const target = findMessagesAttentionJumpTarget(baseConversations, queue);

    expect(target).toEqual({
      conversationId: "jr-pending",
      filter: "pending",
    });
  });

  it("returns null when no queue entries match available conversations", () => {
    const queue = [buildQueueEntry("jr-missing")];
    expect(findMessagesAttentionJumpTarget(baseConversations, queue)).toBeNull();
  });

  it("returns null when the queue is empty", () => {
    expect(findMessagesAttentionJumpTarget(baseConversations, [])).toBeNull();
  });
});
