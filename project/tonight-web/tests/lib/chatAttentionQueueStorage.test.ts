import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { EventChatAttentionPayload } from '@/components/tonight/event-inside/EventInsideExperience';
import {
  CHAT_ATTENTION_QUEUE_STORAGE_KEY,
  deserializeChatAttentionQueue,
  readChatAttentionQueueFromStorage,
  writeChatAttentionQueueToStorage,
} from '@/lib/chatAttentionQueueStorage';

const sampleQueue: EventChatAttentionPayload[] = [
  {
    id: 'jr_1',
    snippet: 'Need the door code please!',
    authorName: 'Mia',
    timestampISO: '2026-02-17T05:45:00.000Z',
    helperText: 'Guests needing replies',
    href: '/chat/jr_1',
  },
  {
    id: 'jr_2',
    snippet: 'We just arrived downstairs.',
    authorName: 'Diego',
    timestampISO: '2026-02-17T05:46:30.000Z',
    helperText: null,
    href: '/chat/jr_2',
  },
];

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

describe('chatAttentionQueueStorage', () => {
  beforeEach(() => {
    const storage = createLocalStorageMock();
    vi.stubGlobal('localStorage', storage);
    vi.stubGlobal('window', {
      localStorage: storage,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    } as unknown as Window & typeof globalThis);
    localStorage.clear();
  });

  it('serializes the queue into localStorage and reads it back', () => {
    writeChatAttentionQueueToStorage(sampleQueue);

    const raw = localStorage.getItem(CHAT_ATTENTION_QUEUE_STORAGE_KEY);
    expect(raw).toBeTruthy();

    const roundTrip = readChatAttentionQueueFromStorage();
    expect(roundTrip).toHaveLength(2);
    expect(roundTrip[0]).toMatchObject({ id: 'jr_1', snippet: 'Need the door code please!', authorName: 'Mia' });
    expect(roundTrip[1]).toMatchObject({ id: 'jr_2', href: '/chat/jr_2' });
  });

  it('removes the storage key when an empty queue is written', () => {
    writeChatAttentionQueueToStorage(sampleQueue);
    writeChatAttentionQueueToStorage([]);

    expect(localStorage.getItem(CHAT_ATTENTION_QUEUE_STORAGE_KEY)).toBeNull();
  });

  it('filters invalid queue entries when decoding raw strings', () => {
    const rawPayload = JSON.stringify([
      { foo: 'bar' },
      { id: 'jr_3', snippet: 'Hello!' },
      { id: 'jr_4', snippet: 7 },
    ]);

    const parsed = deserializeChatAttentionQueue(rawPayload);
    expect(parsed).toEqual([
      { id: 'jr_3', snippet: 'Hello!', authorName: null, timestampISO: null, helperText: null, href: null },
      { id: 'jr_4', snippet: '7', authorName: null, timestampISO: null, helperText: null, href: null },
    ]);
  });
});
