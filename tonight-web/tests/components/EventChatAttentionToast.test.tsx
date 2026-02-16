import { JSDOM } from 'jsdom';
import React from 'react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { EventChatAttentionToast } from '@/components/tonight/EventChatAttentionToast';

type TestingLibrary = typeof import('@testing-library/react');

let render: TestingLibrary['render'];
let screen: TestingLibrary['screen'];
let fireEvent: TestingLibrary['fireEvent'];
let cleanup: TestingLibrary['cleanup'];
let act: TestingLibrary['act'];

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
  act = testingLibrary.act;
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

describe('EventChatAttentionToast', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('renders the helper text, snippet context, and CTA', () => {
    vi.spyOn(Date, 'now').mockReturnValue(new Date('2026-02-17T00:20:00Z').getTime());

    render(
      <EventChatAttentionToast
        href="/chat/abc"
        label="Open chat"
        helperText="Latest note from the host"
        attentionLabel="New ping"
        snippet="Don't forget the speaker setup."
        snippetSender="Aleks"
        snippetTimestamp="2026-02-17T00:18:00Z"
      />
    );

    expect(screen.getByText('New ping')).toBeInTheDocument();
    expect(screen.getByText('Latest note from the host')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /open chat/i })).toHaveAttribute('href', '/chat/abc');
    expect(screen.getByText('Aleks')).toBeInTheDocument();
    expect(screen.getByText('2 minutes ago')).toBeInTheDocument();
    expect(screen.getByText("Don't forget the speaker setup.")).toBeInTheDocument();
  });

  it('invokes onInteract when interacting with the CTA or dismiss button', () => {
    const onInteract = vi.fn();

    render(
      <EventChatAttentionToast
        href="/chat/def"
        label="Jump to chat"
        helperText="The host sent a new update"
        onInteract={onInteract}
      />
    );

    fireEvent.click(screen.getByRole('link', { name: /jump to chat/i }));
    fireEvent.click(screen.getByRole('button', { name: /dismiss chat alert/i }));

    expect(onInteract).toHaveBeenCalledTimes(2);
  });

  it('cycles through queued snippets and updates the CTA href per entry', () => {
    vi.useFakeTimers();

    render(
      <EventChatAttentionToast
        href="/chat/fallback"
        label="Open chat"
        attentionQueue={[
          {
            id: 'first',
            snippet: 'First guest ping',
            authorName: 'Mira',
            timestampISO: '2026-02-17T00:25:00Z',
            href: '/chat/first',
            helperText: 'Mira sent a new message',
          },
          {
            id: 'second',
            snippet: 'Second guest ping',
            authorName: 'Dante',
            timestampISO: '2026-02-17T00:26:00Z',
            href: '/chat/second',
            helperText: 'Dante needs a reply',
          },
        ]}
      />
    );

    expect(screen.getByText('First guest ping')).toBeInTheDocument();
    expect(screen.getByText('1 of 2')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /open chat/i })).toHaveAttribute('href', '/chat/first');

    act(() => {
      vi.advanceTimersByTime(4000);
    });

    expect(screen.getByText('Second guest ping')).toBeInTheDocument();
    expect(screen.getByText('2 of 2')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /open chat/i })).toHaveAttribute('href', '/chat/second');
  });
});
