import { JSDOM } from 'jsdom';
import React from 'react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { MessagesAttentionSummary } from '@/app/messages/page';
import type { EventChatAttentionPayload } from '@/components/tonight/event-inside/EventInsideExperience';

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

const stubQueue = (): EventChatAttentionPayload[] => [
  {
    id: 'jr_123',
    snippet: 'Need a quick update',
    authorName: 'Jess',
    timestampISO: new Date().toISOString(),
    helperText: 'Rooftop 8pm',
    href: '/chat/jr_123',
  },
];

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

describe('MessagesAttentionSummary', () => {
  const noop = () => {};

  beforeEach(() => {
    document.body.innerHTML = '';
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders quick snooze controls using the preferred duration', () => {
    const onSnooze = vi.fn();

    render(
      <MessagesAttentionSummary
        queue={stubQueue()}
        onSelectConversation={noop}
        chatAttentionPreferredSnoozeMinutes={10}
        onChatAttentionSnooze={onSnooze}
      />
    );

    const quickButton = screen.getByRole('button', { name: /quick snooze chat attention alerts/i });
    expect(quickButton).toBeInTheDocument();
    fireEvent.click(quickButton);
    expect(onSnooze).toHaveBeenCalledWith(10);
  });

  it('shows a resume control when chat attention is snoozed', () => {
    const onResume = vi.fn();
    const futureISO = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    render(
      <MessagesAttentionSummary
        queue={stubQueue()}
        onSelectConversation={noop}
        chatAttentionSnoozedUntil={futureISO}
        onChatAttentionResume={onResume}
      />
    );

    expect(screen.getByText(/snoozed/i)).toBeInTheDocument();
    const resumeButton = screen.getByRole('button', { name: /resume alerts/i });
    fireEvent.click(resumeButton);
    expect(onResume).toHaveBeenCalledTimes(1);
  });
});
