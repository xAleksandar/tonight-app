import { JSDOM } from 'jsdom';
import React from 'react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { EventInsideExperience, type EventInsideExperienceProps } from '@/components/tonight/event-inside/EventInsideExperience';

type TestingLibrary = typeof import('@testing-library/react');

let render: TestingLibrary['render'];
let screen: TestingLibrary['screen'];
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
    self: { configurable: true, value: window, writable: true },
    document: { configurable: true, value: window.document, writable: true },
    navigator: { configurable: true, value: window.navigator, writable: true },
    HTMLElement: { configurable: true, value: window.HTMLElement, writable: true },
  });
};

const baseProps: EventInsideExperienceProps = {
  event: {
    id: 'evt-123',
    title: 'Secret rooftop club',
    description: 'Late night chess and tea',
    startDateISO: new Date().toISOString(),
    locationName: 'Near NDK',
    vibeTags: ['invite-only'],
    entryNotes: ['Bring ID'],
    capacityLabel: '10 spots',
  },
  host: {
    id: 'host-1',
    displayName: 'Aleks',
  },
  attendees: [
    { id: 'a1', displayName: 'Mira', status: 'confirmed' },
    { id: 'a2', displayName: 'Viktor', status: 'pending' },
    { id: 'a3', displayName: 'Dea', status: 'waitlist' },
  ],
  joinRequests: [
    {
      id: 'jr-1',
      userId: 'a2',
      displayName: 'Sam',
      intro: 'Can bring board games',
      submittedAtISO: new Date().toISOString(),
    },
  ],
  chatPreview: {
    lastMessageSnippet: 'Doors open at 9',
    lastMessageAtISO: new Date().toISOString(),
    participantCount: 6,
    unreadCount: 2,
    ctaLabel: 'Open chat',
    ctaHref: '/chat/jr-1',
  },
  viewerRole: 'host',
};

beforeAll(async () => {
  ensureDomGlobals();
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  await import('@testing-library/jest-dom/vitest');
  const testingLibrary = await import('@testing-library/react');
  render = testingLibrary.render;
  screen = testingLibrary.screen;
  cleanup = testingLibrary.cleanup;
});

afterAll(() => {
  if (jsdomInstance) {
    jsdomInstance.window.close();
    jsdomInstance = null;
  }
  delete (globalThis as any).window;
  delete (globalThis as any).self;
  delete (globalThis as any).document;
  delete (globalThis as any).navigator;
  delete (globalThis as any).HTMLElement;
});

describe('EventInsideExperience', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  afterEach(() => {
    cleanup();
  });

  it('renders the event overview plus entrance checklist', () => {
    render(<EventInsideExperience {...baseProps} />);

    expect(screen.getByRole('heading', { name: /secret rooftop club/i })).toBeInTheDocument();
    expect(screen.getByText(/Entrance checklist/i)).toBeInTheDocument();
    expect(screen.getByText(/Bring ID/i)).toBeInTheDocument();
  });

  it('groups attendees into their respective buckets', () => {
    render(<EventInsideExperience {...baseProps} />);

    expect(screen.getByText(/Confirmed · 1/i)).toBeInTheDocument();
    expect(screen.getByText(/Awaiting reply · 1/i)).toBeInTheDocument();
    expect(screen.getByText(/Waitlist · 1/i)).toBeInTheDocument();
  });

  it('exposes an actionable chat link when a CTA href is provided', () => {
    render(<EventInsideExperience {...baseProps} />);

    const link = screen.getByRole('link', { name: /open chat/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/chat/jr-1');
  });

  it('shows a disabled chat explanation when no CTA href is present', () => {
    const props: EventInsideExperienceProps = {
      ...baseProps,
      chatPreview: {
        ctaLabel: 'No guest chats yet',
        ctaDisabledReason: 'Approve at least one guest to unlock chat.',
      },
    };
    render(<EventInsideExperience {...props} />);

    const button = screen.getByRole('button', { name: /no guest chats yet/i });
    expect(button).toBeDisabled();
    expect(screen.getByText(/approve at least one guest/i)).toBeInTheDocument();
  });

  it('lists unread guest threads for hosts when provided', () => {
    const props: EventInsideExperienceProps = {
      ...baseProps,
      chatPreview: {
        ...baseProps.chatPreview!,
        hostUnreadThreads: [
          {
            joinRequestId: 'jr-thread-1',
            displayName: 'Lena',
            lastMessageSnippet: 'Hey, quick question about the meetup.',
            lastMessageAtISO: new Date().toISOString(),
            unreadCount: 2,
          },
        ],
      },
    };

    render(<EventInsideExperience {...props} />);

    expect(screen.getByText(/Guests needing replies/i)).toBeInTheDocument();
    expect(screen.getByText('Lena')).toBeInTheDocument();
    expect(screen.getByText(/quick question/i)).toBeInTheDocument();
    const link = screen.getByRole('link', { name: /Lena/i });
    expect(link).toHaveAttribute('href', '/chat/jr-thread-1');
  });
});
