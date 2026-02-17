import React from 'react';
import { JSDOM } from 'jsdom';
import { act, cleanup, render } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { EventInsidePageClient, CHAT_ATTENTION_SNOOZE_STORAGE_KEY, CHAT_ATTENTION_SNOOZE_PREFERENCE_STORAGE_KEY } from '@/app/events/[id]/EventInsidePageClient';
import type { EventInsideExperienceProps } from '@/components/tonight/event-inside/EventInsideExperience';
import { DEFAULT_CHAT_ATTENTION_SNOOZE_MINUTES } from '@/lib/chatAttentionSnoozeOptions';

let latestLayoutProps: any = null;
vi.mock('@/app/events/[id]/EventLayout', () => {
  const React = require('react');
  return {
    EventLayout: (props: any) => {
      latestLayoutProps = props;
      return React.createElement('div', { 'data-testid': 'event-layout' }, props.children);
    },
  };
});

vi.mock('@/components/tonight/event-inside/EventInsideExperience', () => {
  const React = require('react');
  return {
    EventInsideExperience: () => React.createElement('div', { 'data-testid': 'event-inside-experience' }),
  };
});

vi.mock('@/lib/buildMobileChatAction', () => ({
  buildMobileChatAction: () => undefined,
}));

vi.mock('@/lib/buildChatAttentionLabels', () => ({
  buildChatAttentionLabels: () => ({
    leadEntry: null,
    leadLabel: null,
    waitingLabel: null,
    waitingCount: 0,
    indicatorLabel: null,
  }),
}));

vi.mock('@/lib/toast', () => ({
  showSuccessToast: vi.fn(),
}));

let jsdomInstance: JSDOM | null = null;

const ensureDomGlobals = () => {
  if (typeof (globalThis as any).window !== 'undefined' && typeof (globalThis as any).document !== 'undefined') {
    return;
  }

  jsdomInstance = new JSDOM('<!doctype html><html><body></body></html>', {
    url: 'https://tonight.test',
  });
  const { window: jsdomWindow } = jsdomInstance;
  Object.defineProperties(globalThis, {
    window: { configurable: true, value: jsdomWindow, writable: true },
    document: { configurable: true, value: jsdomWindow.document, writable: true },
    navigator: { configurable: true, value: jsdomWindow.navigator, writable: true },
    HTMLElement: { configurable: true, value: jsdomWindow.HTMLElement, writable: true },
    self: { configurable: true, value: jsdomWindow, writable: true },
  });
};

beforeAll(async () => {
  ensureDomGlobals();
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  await import('@testing-library/jest-dom/vitest');
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

const baseExperience: EventInsideExperienceProps = {
  event: {
    id: 'event-1',
    title: 'Tonight Rooftop',
    description: null,
    startDateISO: null,
    locationName: 'Hidden Rooftop',
    vibeTags: [],
    entryNotes: [],
    capacityLabel: null,
  },
  host: {
    id: 'host-1',
    displayName: 'Aleks',
    bio: null,
    email: null,
    avatarUrl: null,
  },
  attendees: [],
  joinRequests: [],
  viewerRole: 'host',
  chatPreview: undefined,
  hostFriendInvites: [],
  hostChatParticipants: [],
  socketToken: null,
  pendingJoinRequestId: null,
};

const baseLayoutProps = {
  eventTitle: baseExperience.event.title,
  eventLocation: baseExperience.event.locationName ?? 'Unknown',
  userDisplayName: 'Aleks',
  userEmail: 'aleks@example.com',
  userPhotoUrl: null,
};

describe('EventInsidePageClient chat attention snooze persistence', () => {
  beforeEach(() => {
    window.localStorage.clear();
    delete document.documentElement.dataset.chatAttentionSnoozedUntil;
    latestLayoutProps = null;
  });

  afterEach(() => {
    cleanup();
  });

  const renderClient = () =>
    render(<EventInsidePageClient experience={baseExperience} layoutProps={baseLayoutProps} />);

  it('passes the default preferred snooze duration to the layout', () => {
    renderClient();
    expect(latestLayoutProps?.chatAttentionPreferredSnoozeMinutes).toBe(DEFAULT_CHAT_ATTENTION_SNOOZE_MINUTES);
  });

  it('restores a stored snooze timestamp on mount', () => {
    const futureISO = new Date(Date.now() + 60_000).toISOString();
    window.localStorage.setItem(CHAT_ATTENTION_SNOOZE_STORAGE_KEY, futureISO);

    renderClient();

    expect(window.localStorage.getItem(CHAT_ATTENTION_SNOOZE_STORAGE_KEY)).toBe(futureISO);
    expect(document.documentElement.dataset.chatAttentionSnoozedUntil).toBe(futureISO);
    expect(latestLayoutProps?.chatAttentionSnoozedUntil).toBe(futureISO);
  });

  it('ignores expired snooze timestamps from storage', () => {
    const pastISO = new Date(Date.now() - 60_000).toISOString();
    window.localStorage.setItem(CHAT_ATTENTION_SNOOZE_STORAGE_KEY, pastISO);

    renderClient();

    expect(window.localStorage.getItem(CHAT_ATTENTION_SNOOZE_STORAGE_KEY)).toBeNull();
    expect(document.documentElement.dataset.chatAttentionSnoozedUntil).toBeUndefined();
    expect(latestLayoutProps?.chatAttentionSnoozedUntil ?? null).toBeNull();
  });

  it('saves and clears snooze state via the layout controls', async () => {
    renderClient();
    expect(latestLayoutProps).not.toBeNull();

    await act(async () => {
      latestLayoutProps.onChatAttentionSnooze?.();
    });

    const storedValue = window.localStorage.getItem(CHAT_ATTENTION_SNOOZE_STORAGE_KEY);
    expect(storedValue).toEqual(document.documentElement.dataset.chatAttentionSnoozedUntil);
    expect(typeof storedValue).toBe('string');

    await act(async () => {
      latestLayoutProps.onChatAttentionResume?.();
    });

    expect(window.localStorage.getItem(CHAT_ATTENTION_SNOOZE_STORAGE_KEY)).toBeNull();
    expect(document.documentElement.dataset.chatAttentionSnoozedUntil).toBeUndefined();
  });

  it('hydrates the preferred snooze duration from storage', () => {
    window.localStorage.setItem(CHAT_ATTENTION_SNOOZE_PREFERENCE_STORAGE_KEY, '10');

    renderClient();

    expect(latestLayoutProps?.chatAttentionPreferredSnoozeMinutes).toBe(10);
  });

  it('persists the latest preferred snooze duration when snoozing', async () => {
    renderClient();

    await act(async () => {
      latestLayoutProps.onChatAttentionSnooze?.(20);
    });

    expect(window.localStorage.getItem(CHAT_ATTENTION_SNOOZE_PREFERENCE_STORAGE_KEY)).toBe('20');
    expect(latestLayoutProps?.chatAttentionPreferredSnoozeMinutes).toBe(20);
  });
});
