import { JSDOM } from 'jsdom';
import React from 'react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { MobileActionBar } from '@/components/tonight/MobileActionBar';

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

describe('MobileActionBar', () => {
  const noop = () => {};

  beforeEach(() => {
    document.body.innerHTML = '';
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('highlights the active nav item', () => {
    render(
      <MobileActionBar
        active="people"
        onNavigateDiscover={noop}
        onNavigatePeople={noop}
        onNavigateMessages={noop}
        onCreate={noop}
        onOpenProfile={noop}
      />
    );

    const peopleButton = screen.getByRole('button', { name: /people/i });
    const discoverButton = screen.getByRole('button', { name: /discover/i });

    expect(peopleButton).toHaveAttribute('aria-current', 'page');
    expect(discoverButton).not.toHaveAttribute('aria-current');
  });

  it('routes through the provided callbacks', () => {
    const onNavigateDiscover = vi.fn();
    const onNavigatePeople = vi.fn();
    const onNavigateMessages = vi.fn();
    const onCreate = vi.fn();
    const onOpenProfile = vi.fn();

    render(
      <MobileActionBar
        active="discover"
        onNavigateDiscover={onNavigateDiscover}
        onNavigatePeople={onNavigatePeople}
        onNavigateMessages={onNavigateMessages}
        onCreate={onCreate}
        onOpenProfile={onOpenProfile}
        messagesUnreadCount={3}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /discover/i }));
    fireEvent.click(screen.getByRole('button', { name: /people/i }));
    fireEvent.click(screen.getByRole('button', { name: /messages/i }));
    fireEvent.click(screen.getByRole('button', { name: /post event/i }));
    fireEvent.click(screen.getByRole('button', { name: /profile/i }));

    expect(onNavigateDiscover).toHaveBeenCalledTimes(1);
    expect(onNavigatePeople).toHaveBeenCalledTimes(1);
    expect(onNavigateMessages).toHaveBeenCalledTimes(1);
    expect(onCreate).toHaveBeenCalledTimes(1);
    expect(onOpenProfile).toHaveBeenCalledTimes(1);
  });

  it('renders chat action details when provided', () => {
    render(
      <MobileActionBar
        active="discover"
        onNavigateDiscover={noop}
        onNavigatePeople={noop}
        onNavigateMessages={noop}
        onCreate={noop}
        onOpenProfile={noop}
        chatAction={{
          href: '/chat/abc',
          label: 'Open chat',
          helperText: 'Latest note from the host',
          badgeLabel: '2 unread',
          badgeTone: 'highlight',
        }}
      />
    );

    expect(screen.getByRole('link', { name: /open chat/i })).toHaveAttribute('href', '/chat/abc');
    expect(screen.getByText('2 unread')).toBeInTheDocument();
    expect(screen.getByText('Latest note from the host')).toBeInTheDocument();
  });

  it('shows the attention indicator when a new chat ping arrives', () => {
    const onInteract = vi.fn();

    render(
      <MobileActionBar
        active="discover"
        onNavigateDiscover={noop}
        onNavigatePeople={noop}
        onNavigateMessages={noop}
        onCreate={noop}
        onOpenProfile={noop}
        chatAction={{
          href: '/chat/abc',
          label: 'Open chat',
          helperText: 'Latest note from the host',
          badgeLabel: '2 unread',
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

  it('makes chat attention chips clickable and exposes the queued guest list', () => {
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
        authorName: 'Mia',
        snippet: 'Can I bring a friend?',
        href: '/chat/mia',
        timestampISO: new Date().toISOString(),
      },
    ];

    render(
      <MobileActionBar
        active="discover"
        onNavigateDiscover={noop}
        onNavigatePeople={noop}
        onNavigateMessages={noop}
        onCreate={noop}
        onOpenProfile={noop}
        chatAction={{
          href: '/chat/abc',
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
    const miaLink = screen.getByRole('link', { name: /open chat with mia/i });
    expect(miaLink).toBeInTheDocument();
    fireEvent.click(miaLink);
    expect(onInteract).toHaveBeenCalledTimes(2);
  });
});
