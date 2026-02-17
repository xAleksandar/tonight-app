import { JSDOM } from 'jsdom';
import React from 'react';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { ConversationList } from '@/components/chat/ConversationList';
import type { ConversationPreview } from '@/components/chat/conversations';

type TestingLibrary = typeof import('@testing-library/react');

let render: TestingLibrary['render'];
let screen: TestingLibrary['screen'];
let fireEvent: TestingLibrary['fireEvent'];
let cleanup: TestingLibrary['cleanup'];

let jsdomInstance: JSDOM | null = null;

const ensureDomGlobals = () => {
  if (typeof document !== 'undefined') {
    return;
  }

  jsdomInstance = new JSDOM('<!doctype html><html><body></body></html>');
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
});
