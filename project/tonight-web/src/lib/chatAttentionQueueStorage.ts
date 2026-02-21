import type { EventChatAttentionPayload } from "@/components/tonight/event-inside/EventInsideExperience";

export const CHAT_ATTENTION_QUEUE_STORAGE_KEY = "tonight.chatAttentionQueue";

type SerializableChatAttentionEntry = Pick<
  EventChatAttentionPayload,
  "id" | "snippet" | "authorName" | "timestampISO" | "helperText" | "href"
>;

const normalizeQueue = (value: unknown): EventChatAttentionPayload[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((entry): entry is SerializableChatAttentionEntry => Boolean(entry && typeof entry.id === "string"))
    .map((entry) => ({
      id: entry.id,
      snippet: typeof entry.snippet === "string" ? entry.snippet : String(entry.snippet ?? ""),
      authorName: typeof entry.authorName === "string" ? entry.authorName : entry.authorName ?? null,
      timestampISO: typeof entry.timestampISO === "string" ? entry.timestampISO : entry.timestampISO ?? null,
      helperText: typeof entry.helperText === "string" ? entry.helperText : entry.helperText ?? null,
      href: typeof entry.href === "string" ? entry.href : entry.href ?? null,
    }));
};

const parseQueueString = (raw?: string | null): EventChatAttentionPayload[] => {
  if (!raw || typeof raw !== "string") {
    return [];
  }
  try {
    const parsed = JSON.parse(raw);
    return normalizeQueue(parsed);
  } catch {
    return [];
  }
};

const hasBrowserStorage = (): boolean => typeof window !== "undefined" && typeof window.localStorage !== "undefined";

export const readChatAttentionQueueFromStorage = (): EventChatAttentionPayload[] => {
  if (!hasBrowserStorage()) {
    return [];
  }
  const raw = window.localStorage.getItem(CHAT_ATTENTION_QUEUE_STORAGE_KEY);
  return parseQueueString(raw);
};

export const writeChatAttentionQueueToStorage = (queue: EventChatAttentionPayload[]): void => {
  if (!hasBrowserStorage()) {
    return;
  }
  if (!queue.length) {
    window.localStorage.removeItem(CHAT_ATTENTION_QUEUE_STORAGE_KEY);
    return;
  }
  const payload: SerializableChatAttentionEntry[] = queue.map((entry) => ({
    id: entry.id,
    snippet: typeof entry.snippet === "string" ? entry.snippet : String(entry.snippet ?? ""),
    authorName: entry.authorName ?? null,
    timestampISO: entry.timestampISO ?? null,
    helperText: entry.helperText ?? null,
    href: entry.href ?? null,
  }));
  window.localStorage.setItem(CHAT_ATTENTION_QUEUE_STORAGE_KEY, JSON.stringify(payload));
};

export const subscribeToChatAttentionQueueStorage = (
  callback: (queue: EventChatAttentionPayload[]) => void
): (() => void) => {
  if (!hasBrowserStorage()) {
    return () => {};
  }
  const handler = (event: StorageEvent) => {
    if (event.key !== CHAT_ATTENTION_QUEUE_STORAGE_KEY) {
      return;
    }
    callback(parseQueueString(event.newValue));
  };
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener("storage", handler);
  };
};

export const deserializeChatAttentionQueue = (raw?: string | null): EventChatAttentionPayload[] => parseQueueString(raw);
