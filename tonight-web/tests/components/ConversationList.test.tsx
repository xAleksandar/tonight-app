import { JSDOM } from 'jsdom';
import React from 'react';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { ConversationList } from '@/components/chat/ConversationList';
import { CHAT_DRAFTS_STORAGE_KEY } from '@/lib/chatDraftStorage';
import type { ConversationPreview } from '@/components/chat/conversations';

type TestingLibrary = typeof import('@testing-library/react');

let render: TestingLibrary['render'];
let screen: TestingLibrary['screen'];
let fireEvent: TestingLibrary['fireEvent'];
let cleanup: TestingLibrary['cleanup'];
let waitFor: TestingLibrary['waitFor'];

let jsdomInstance: JSDOM | null = null;

const ensureDomGlobals = () => {
  if (typeof document !== 'undefined') {
    return;
  }

  jsdomInstance = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://tonight.test' });
  const { window } = jsdomInstance;
  Object.defineProperties(globalThis, {
    window: { configurable: true, value: window, writable: true },
    document: { configurable: true, value: window.document, writable: true },
    navigator: { configurable: true, value: window.navigator, writable: true },
    HTMLElement: { configurable: true, value: window.HTMLElement, writable: true },
    self: { configurable: true, value: window, writable: true },
  });
};

beforeAll(async () => {
  ensureDomGlobals();
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  await import('@testing-library/jest-dom/vitest');
  const testingLibrary = await import('@testing-library/react');
  render = testingLibrary.render;
  screen = testingLibrary.screen;
  fireEvent = testingLibrary.fireEvent;
  cleanup = testingLibrary.cleanup;
  waitFor = testingLibrary.waitFor;
});

afterAll(() => {
  if (jsdomInstance) {
    jsdomInstance.window.close();
    jsdomInstance = null;
  }
  delete (globalThis as any).window;
  delete (globalThis as any).document;
  delete (globalThis as any).navigator;
  delete (globalThis as any).HTMLElement;
  delete (globalThis as any).self;
});

describe('ConversationList', () => {
  const baseConversations: ConversationPreview[] = [
    {
      id: 'jr-1',
      participantName: 'Nina L.',
      eventTitle: 'Jazz at Midnight',
      eventCategoryLabel: 'Music',
      messageSnippet: 'Can you share the set time?',
      updatedAtLabel: '2 min ago',
      status: 'accepted',
      unreadCount: 2,
    },
    {
      id: 'jr-2',
      participantName: 'Marco R.',
      eventTitle: 'Gallery Crawl',
      eventCategoryLabel: 'Art',
      messageSnippet: 'Pending approval',
      updatedAtLabel: '10 min ago',
      status: 'pending',
    },
  ];

  afterEach(() => {
    cleanup();
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.clear();
    }
    vi.restoreAllMocks();
  });

  it('highlights conversations that are in the chat attention queue', () => {
    const queue = [
      {
        id: 'jr-1',
        authorName: 'Nina',
        snippet: 'Need the final headcount?',
        timestampISO: new Date().toISOString(),
        helperText: 'Waiting on host',
        href: '/chat/jr-1',
      },
    ];

    render(
      <ConversationList
        conversations={baseConversations}
        attentionQueue={queue}
      />
    );

    expect(screen.getByText(/needs reply/i)).toBeInTheDocument();
    expect(screen.getByText('Need the final headcount?')).toBeInTheDocument();
    expect(screen.getByText(/waiting on host/i)).toBeInTheDocument();
  });

  it('fires the attention handler when the mark handled control is pressed', () => {
    const onHandled = vi.fn();
    const queue = [
      {
        id: 'jr-1',
        authorName: 'Nina',
        snippet: 'Need the final headcount?',
        timestampISO: new Date().toISOString(),
      },
    ];

    render(
      <ConversationList
        conversations={baseConversations}
        attentionQueue={queue}
        onAttentionEntryHandled={onHandled}
      />
    );

    const button = screen.getByRole('button', { name: /mark handled/i });
    fireEvent.click(button);
    expect(onHandled).toHaveBeenCalledTimes(1);
    expect(onHandled).toHaveBeenCalledWith('jr-1');
  });

  it('surfaces saved drafts when enabled', async () => {
    const timestamp = new Date('2026-02-17T09:00:00Z').toISOString();
    window.localStorage.setItem(
      CHAT_DRAFTS_STORAGE_KEY,
      JSON.stringify({
        'jr-1': { content: 'Draft reply for Nina', updatedAt: timestamp },
      })
    );

    render(
      <ConversationList
        conversations={baseConversations}
        showDraftIndicators
      />
    );

    expect(await screen.findByText(/draft ready/i)).toBeInTheDocument();
    expect(screen.getByText('Draft reply for Nina')).toBeInTheDocument();

    const clearButton = screen.getByRole('button', { name: /clear draft/i });
    fireEvent.click(clearButton);

    await waitFor(() => {
      expect(screen.queryByText('Draft reply for Nina')).not.toBeInTheDocument();
    });
    expect(window.localStorage.getItem(CHAT_DRAFTS_STORAGE_KEY)).toBeNull();
  });

  it('hides draft indicators when disabled', async () => {
    const timestamp = new Date('2026-02-17T09:05:00Z').toISOString();
    window.localStorage.setItem(
      CHAT_DRAFTS_STORAGE_KEY,
      JSON.stringify({
        'jr-1': { content: 'Draft reply for Nina', updatedAt: timestamp },
      })
    );

    render(
      <ConversationList
        conversations={baseConversations}
      />
    );

    await waitFor(() => {
      expect(screen.queryByText(/draft ready/i)).not.toBeInTheDocument();
    });
  });

});
