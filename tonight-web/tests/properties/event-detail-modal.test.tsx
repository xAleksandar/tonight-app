import React from 'react';
import { JSDOM } from 'jsdom';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import EventDetailModal, { type EventDetail, type HostProfile } from '@/components/EventDetailModal';

type EventDetailModalProps = React.ComponentProps<typeof EventDetailModal>;

type RenderResult = {
  getButton: () => HTMLButtonElement;
  getMessage: () => HTMLParagraphElement | null;
  cleanup: () => Promise<void>;
};

let jsdomInstance: JSDOM | null = null;
const originalFetch = global.fetch;

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
  });
};

beforeAll(() => {
  ensureDomGlobals();
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
});

afterAll(() => {
  if (!jsdomInstance) {
    return;
  }
  jsdomInstance.window.close();
  jsdomInstance = null;
  delete (globalThis as any).window;
  delete (globalThis as any).document;
  delete (globalThis as any).navigator;
  delete (globalThis as any).HTMLElement;
});

afterEach(() => {
  vi.restoreAllMocks();
  global.fetch = originalFetch;
});

const baseEvent: EventDetail = {
  id: 'evt_test',
  title: 'Neighborhood vinyl swap',
  description: 'Bring a record to trade',
  datetimeISO: new Date('2026-05-01T18:00:00Z').toISOString(),
  locationName: 'Downtown loft',
  attendeeCount: 1,
  maxParticipants: 5,
  location: {
    latitude: 37.7749,
    longitude: -122.4194,
  },
};

const baseHost: HostProfile = {
  id: 'host_test',
  email: 'host@example.com',
  displayName: 'Riley Host',
  photoUrl: null,
};

async function renderModal(overrides: Partial<EventDetailModalProps> = {}): Promise<RenderResult> {
  const hostNode = document.createElement('div');
  document.body.appendChild(hostNode);
  const root = createRoot(hostNode);

  const props: EventDetailModalProps = {
    event: overrides.event ?? baseEvent,
    host: overrides.host ?? baseHost,
    isOpen: overrides.isOpen ?? true,
    onClose: overrides.onClose,
    onRequestJoin: overrides.onRequestJoin,
    joinStatus: overrides.joinStatus,
    joinStatusMessage: overrides.joinStatusMessage,
    requestButtonLabel: overrides.requestButtonLabel,
    disableRequest: overrides.disableRequest,
  };

  await act(async () => {
    root.render(<EventDetailModal {...props} />);
    await Promise.resolve();
  });

  return {
    getButton: () => document.querySelector('[data-testid="join-request-button"]') as HTMLButtonElement,
    getMessage: () => document.querySelector('[data-testid="join-request-message"]') as HTMLParagraphElement | null,
    cleanup: async () => {
      await act(async () => {
        root.unmount();
        await Promise.resolve();
      });
      hostNode.remove();
    },
  };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('EventDetailModal join request handling', () => {
  it('submits a join request through the default handler and reports success', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ joinRequest: { id: 'jr_test', eventId: baseEvent.id } }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const { getButton, getMessage, cleanup } = await renderModal();

    try {
      await act(async () => {
        getButton().click();
        await flush();
      });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/join-requests',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
        })
      );

      const message = getMessage();
      expect(message).not.toBeNull();
      expect(message?.dataset.status).toBe('success');
      expect(message?.textContent).toContain('Request sent');

      expect(getButton().disabled).toBe(true);
    } finally {
      await cleanup();
    }
  });

  it('surfaces API errors and keeps the button enabled', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({ error: 'You have already requested to join this event' }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const { getButton, getMessage, cleanup } = await renderModal();

    try {
      await act(async () => {
        getButton().click();
        await flush();
      });

      expect(fetchMock).toHaveBeenCalledTimes(1);

      const message = getMessage();
      expect(message).not.toBeNull();
      expect(message?.dataset.status).toBe('error');
      expect(message?.textContent).toContain('already requested');

      expect(getButton().disabled).toBe(false);
    } finally {
      await cleanup();
    }
  });
});
