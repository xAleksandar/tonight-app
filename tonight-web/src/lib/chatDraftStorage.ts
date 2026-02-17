const CHAT_DRAFTS_STORAGE_KEY = "tonight.chatDrafts";
const MAX_STORED_CHAT_DRAFTS = 25;

type ChatDraftPayload = {
  content: string;
  updatedAt: string;
};

type ChatDraftMap = Record<string, ChatDraftPayload>;

const hasBrowserStorage = () => typeof window !== "undefined" && typeof window.localStorage !== "undefined";

const normalizeDraftMap = (value: unknown): ChatDraftMap => {
  if (!value || typeof value !== "object") {
    return {};
  }
  return Object.entries(value as Record<string, unknown>).reduce<ChatDraftMap>((acc, [key, payload]) => {
    if (typeof key !== "string" || !payload || typeof payload !== "object") {
      return acc;
    }
    const content = (payload as { content?: unknown }).content;
    if (typeof content !== "string") {
      return acc;
    }
    const updatedAtRaw = (payload as { updatedAt?: unknown }).updatedAt;
    const updatedAt = typeof updatedAtRaw === "string" && !Number.isNaN(Date.parse(updatedAtRaw))
      ? updatedAtRaw
      : new Date().toISOString();
    acc[key] = { content, updatedAt };
    return acc;
  }, {});
};

const readDraftMap = (): ChatDraftMap => {
  if (!hasBrowserStorage()) {
    return {};
  }
  const raw = window.localStorage.getItem(CHAT_DRAFTS_STORAGE_KEY);
  if (!raw) {
    return {};
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    return normalizeDraftMap(parsed);
  } catch {
    return {};
  }
};

const writeDraftMap = (map: ChatDraftMap) => {
  if (!hasBrowserStorage()) {
    return;
  }
  const entries = Object.entries(map);
  if (!entries.length) {
    window.localStorage.removeItem(CHAT_DRAFTS_STORAGE_KEY);
    return;
  }
  let workingMap: ChatDraftMap = map;
  if (entries.length > MAX_STORED_CHAT_DRAFTS) {
    const sorted = entries.sort((a, b) => {
      const aTime = Date.parse(a[1].updatedAt);
      const bTime = Date.parse(b[1].updatedAt);
      return bTime - aTime;
    });
    const trimmed = sorted.slice(0, MAX_STORED_CHAT_DRAFTS);
    workingMap = trimmed.reduce<ChatDraftMap>((acc, [key, payload]) => {
      acc[key] = payload;
      return acc;
    }, {});
  }
  window.localStorage.setItem(CHAT_DRAFTS_STORAGE_KEY, JSON.stringify(workingMap));
};

export const readChatDraftFromStorage = (joinRequestId: string): string => {
  if (!joinRequestId) {
    return "";
  }
  const drafts = readDraftMap();
  return drafts[joinRequestId]?.content ?? "";
};

export const writeChatDraftToStorage = (joinRequestId: string, content: string): void => {
  if (!joinRequestId || typeof content !== "string") {
    return;
  }
  if (!content.length) {
    clearChatDraftFromStorage(joinRequestId);
    return;
  }
  const drafts = readDraftMap();
  drafts[joinRequestId] = {
    content,
    updatedAt: new Date().toISOString(),
  };
  writeDraftMap(drafts);
};

export const clearChatDraftFromStorage = (joinRequestId: string): void => {
  if (!joinRequestId) {
    return;
  }
  const drafts = readDraftMap();
  if (!(joinRequestId in drafts)) {
    return;
  }
  delete drafts[joinRequestId];
  writeDraftMap(drafts);
};

export const __unsafeReadDraftMap = (): ChatDraftMap => readDraftMap();

export { CHAT_DRAFTS_STORAGE_KEY, MAX_STORED_CHAT_DRAFTS };
