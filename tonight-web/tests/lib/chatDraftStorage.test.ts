/** @vitest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  CHAT_DRAFTS_STORAGE_KEY,
  MAX_STORED_CHAT_DRAFTS,
  clearChatDraftFromStorage,
  readChatDraftFromStorage,
  writeChatDraftToStorage,
} from '@/lib/chatDraftStorage';

const createLocalStorageMock = () => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => (key in store ? store[key] : null)),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = String(value);
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  } as Storage;
};

describe('chatDraftStorage', () => {
  beforeEach(() => {
    const storage = createLocalStorageMock();
    vi.stubGlobal('localStorage', storage);
    vi.stubGlobal('window', {
      localStorage: storage,
    } as unknown as Window & typeof globalThis);
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('writes and reads drafts per join request', () => {
    expect(readChatDraftFromStorage('jr_1')).toBe('');

    writeChatDraftToStorage('jr_1', 'Working on a reply');
    writeChatDraftToStorage('jr_2', 'Following up soon');

    expect(readChatDraftFromStorage('jr_1')).toBe('Working on a reply');
    expect(readChatDraftFromStorage('jr_2')).toBe('Following up soon');

    const raw = localStorage.getItem(CHAT_DRAFTS_STORAGE_KEY);
    expect(raw).toBeTruthy();
    const parsed = raw ? JSON.parse(raw) : {};
    expect(Object.keys(parsed)).toContain('jr_1');
    expect(Object.keys(parsed)).toContain('jr_2');
  });

  it('clears drafts when emptied explicitly or via helper', () => {
    writeChatDraftToStorage('jr_3', 'Initial draft');
    expect(readChatDraftFromStorage('jr_3')).toBe('Initial draft');

    // Writing an empty string should remove the entry
    writeChatDraftToStorage('jr_3', '');
    expect(readChatDraftFromStorage('jr_3')).toBe('');

    writeChatDraftToStorage('jr_4', 'Keep this one');
    clearChatDraftFromStorage('jr_4');
    expect(readChatDraftFromStorage('jr_4')).toBe('');

    expect(localStorage.getItem(CHAT_DRAFTS_STORAGE_KEY)).toBeNull();
  });

  it('prunes oldest drafts once the storage limit is exceeded', () => {
    vi.useFakeTimers();

    const extras = 5;
    const totalDrafts = MAX_STORED_CHAT_DRAFTS + extras;

    for (let index = 0; index < totalDrafts; index += 1) {
      vi.setSystemTime(new Date(2026, 1, 17, 10, 0, index));
      writeChatDraftToStorage(`jr_${index}`, `Draft ${index}`);
    }

    const raw = localStorage.getItem(CHAT_DRAFTS_STORAGE_KEY);
    expect(raw).toBeTruthy();
    const parsed = raw ? JSON.parse(raw) : {};
    const storedKeys = Object.keys(parsed);

    expect(storedKeys).toHaveLength(MAX_STORED_CHAT_DRAFTS);
    // Expect the most recent drafts to be kept
    for (let index = extras; index < totalDrafts; index += 1) {
      expect(storedKeys).toContain(`jr_${index}`);
    }
    // Oldest entries should have been pruned
    for (let index = 0; index < extras; index += 1) {
      expect(storedKeys).not.toContain(`jr_${index}`);
    }
  });
});
