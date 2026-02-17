import { JSDOM } from 'jsdom';
import React from 'react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { DesktopHeader } from '@/components/tonight/DesktopHeader';

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

describe('DesktopHeader', () => {
  const noop = () => {};

  beforeEach(() => {
    document.body.innerHTML = '';
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders the chat CTA when chat action metadata is present', () => {
    render(
      <DesktopHeader
        title="Tonight event"
        subtitle="Downtown"
        unreadCount={0}
        onNavigateProfile={noop}
        onNavigateMessages={noop}
        chatAction={{
          href: '/chat/demo',
          label: 'Open chat',
          helperText: 'Latest note from the host',
          badgeLabel: '2 unread',
          badgeTone: 'highlight',
        }}
      />
    );

    expect(screen.getByRole('link', { name: /open chat/i })).toHaveAttribute('href', '/chat/demo');
    expect(screen.getByText('Latest note from the host')).toBeInTheDocument();
    expect(screen.getByText('2 unread')).toBeInTheDocument();
  });

  it('shows the attention indicator and clears it via onInteract', () => {
    const onInteract = vi.fn();

    render(
      <DesktopHeader
        title="Tonight event"
        onNavigateProfile={noop}
        onNavigateMessages={noop}
        chatAction={{
          href: '/chat/demo',
          label: 'Open chat',
          badgeLabel: '1 unread',
          badgeTone: 'highlight',
          attentionActive: true,
          attentionLabel: 'New chat ping',
          onInteract,
        }}
      />
    );

    expect(screen.getByText('New chat ping')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('link', { name: /open chat/i }));
    expect(onInteract).toHaveBeenCalledTimes(1);
  });

  it('clears every queued chat attention entry via the bulk action', () => {
    const onClearAll = vi.fn();
    const queue = [
      {
        id: 'entry-1',
        authorName: 'Jess',
        snippet: 'Need a quick update',
        href: '/chat/jess',
        timestampISO: new Date().toISOString(),
      },
      {
        id: 'entry-2',
        authorName: 'Mira',
        snippet: 'Any dress code?',
        href: '/chat/mira',
        timestampISO: new Date().toISOString(),
      },
    ];

    render(
      <DesktopHeader
        title="Tonight event"
        onNavigateProfile={noop}
        onNavigateMessages={noop}
        chatAction={{
          href: '/chat/demo',
          label: 'Open chat',
          badgeLabel: 'Queue',
          badgeTone: 'highlight',
          attentionActive: true,
          attentionLabel: 'New chat ping',
        }}
        chatAttentionQueue={queue}
        onChatAttentionClearAll={onClearAll}
      />
    );

    const markAllButton = screen.getByRole('button', { name: /mark all chat attention entries as handled/i });
    fireEvent.click(markAllButton);
    expect(onClearAll).toHaveBeenCalledTimes(1);
  });

  it('makes chat attention chips actionable and exposes the queued guest list', () => {
    const onInteract = vi.fn();
    const queue = [
      {
        id: 'entry-1',
        authorName: 'Jess',
        snippet: 'Need a quick update',
        href: '/chat/jess',
        timestampISO: new Date().toISOString(),
      },
      {
        id: 'entry-2',
        authorName: 'Alex',
        snippet: 'Any dress code?',
        href: '/chat/alex',
        timestampISO: new Date().toISOString(),
      },
    ];

    render(
      <DesktopHeader
        title="Tonight event"
        onNavigateProfile={noop}
        onNavigateMessages={noop}
        chatAction={{
          href: '/chat/demo',
          label: 'Open chat',
          badgeLabel: "You're caught up",
          badgeTone: 'success',
          onInteract,
        }}
        chatAttentionQueue={queue}
      />
    );

    const leadChip = screen.getByRole('link', { name: /open chat with jess/i });
    fireEvent.click(leadChip);
    expect(onInteract).toHaveBeenCalledTimes(1);

    const toggle = screen.getByRole('button', { name: /view queued guests/i });
    fireEvent.click(toggle);
    const alexLink = screen.getByRole('link', { name: /open chat with alex/i });
    expect(alexLink).toBeInTheDocument();
    fireEvent.click(alexLink);
    expect(onInteract).toHaveBeenCalledTimes(2);
  });
  it('snoozes and resumes chat attention alerts from the header controls', () => {
    const onSnooze = vi.fn();
    const onResume = vi.fn();
    const queue = [
      {
        id: 'entry-1',
        authorName: 'Jess',
        snippet: 'Need a quick update',
        href: '/chat/jess',
        timestampISO: new Date().toISOString(),
      },
    ];
    const futureISO = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    const { rerender } = render(
      <DesktopHeader
        title='Tonight event'
        onNavigateProfile={noop}
        onNavigateMessages={noop}
        chatAction={{ href: '/chat/demo', label: 'Open chat', badgeTone: 'highlight', badgeLabel: '1 unread' }}
        chatAttentionQueue={queue}
        onChatAttentionSnooze={onSnooze}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /snooze chat attention alerts for 20 minutes/i }));
    expect(onSnooze).toHaveBeenCalledWith(20);
    expect(onSnooze).toHaveBeenCalledTimes(1);

    rerender(
      <DesktopHeader
        title='Tonight event'
        onNavigateProfile={noop}
        onNavigateMessages={noop}
        chatAction={{ href: '/chat/demo', label: 'Open chat', badgeTone: 'highlight', badgeLabel: '1 unread' }}
        chatAttentionQueue={queue}
        chatAttentionSnoozedUntil={futureISO}
        onChatAttentionSnooze={onSnooze}
        onChatAttentionResume={onResume}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /resume chat attention alerts/i }));
    expect(onResume).toHaveBeenCalledTimes(1);
  });

});
