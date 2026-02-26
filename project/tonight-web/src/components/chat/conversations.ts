export type ConversationPreview = {
  id: string;
  participantName: string;
  eventTitle?: string;
  locationName?: string;
  eventCategoryLabel?: string;
  messageSnippet: string;
  updatedAtLabel: string;
  status: "pending" | "accepted";
  unreadCount?: number;
};

export const PLACEHOLDER_CONVERSATIONS: ConversationPreview[] = [
  {
    id: "demo-1",
    participantName: "Elena K.",
    eventTitle: "Sushi Dinner",
    eventCategoryLabel: "Food",
    messageSnippet: "Great! See you at 9 then. I'll be at the bar.",
    updatedAtLabel: "5 min ago",
    status: "accepted",
    unreadCount: 2,
  },
  {
    id: "demo-2",
    participantName: "Sofia M.",
    eventTitle: "Live Jazz Night",
    eventCategoryLabel: "Music",
    messageSnippet: "Looking forward to it! Do you know the band?",
    updatedAtLabel: "1 hour ago",
    status: "accepted",
  },
  {
    id: "demo-3",
    participantName: "Dan P.",
    eventTitle: "Evening Gym Session",
    eventCategoryLabel: "Fitness",
    messageSnippet: "Waiting for host response...",
    updatedAtLabel: "2 hours ago",
    status: "pending",
  },
];

export const hasPlaceholderConversationData = (conversations?: ConversationPreview[]) => {
  if (!Array.isArray(conversations) || conversations.length === 0) {
    return true;
  }
  return conversations.every((conversation) => conversation.id.startsWith("demo-"));
};
