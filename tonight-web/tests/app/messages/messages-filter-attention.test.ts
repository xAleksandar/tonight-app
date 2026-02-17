import { describe, expect, it } from "vitest";

import { buildMessagesFilterAttentionCounts } from "@/app/messages/page";
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
