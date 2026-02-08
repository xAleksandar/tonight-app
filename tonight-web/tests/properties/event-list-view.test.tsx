import React from 'react';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import EventListView, { type EventListItem } from '@/components/EventListView';

type RenderResult = {
  listItems: HTMLLIElement[];
  cleanup: () => Promise<void>;
};

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

const readableString = fc
  .array(fc.constantFrom('a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z', ' ', '-', "'"), {
    minLength: 1,
    maxLength: 32,
  })
  .map((chars) => {
    const collapsed = chars.join('').trim().replace(/\s+/g, ' ');
    return collapsed.length > 0 ? collapsed : 'tonight';
  });

const dateString = fc
  .integer({
    min: Date.parse('2024-01-01T00:00:00.000Z'),
    max: Date.parse('2027-12-31T23:59:59.999Z'),
  })
  .map((timestamp) => new Date(timestamp).toISOString());

const distanceValue = fc.double({ min: 1, max: 50000, noNaN: true, noDefaultInfinity: true });

const eventItemArb = fc.record<EventListItem>({
  id: fc.uuid(),
  title: readableString,
  locationName: readableString,
  datetimeISO: dateString,
  distanceMeters: distanceValue,
  description: fc.option(readableString, { nil: undefined }),
});

const eventsArrayArb = fc.array(eventItemArb, { minLength: 1, maxLength: 6 });

const normalizeWhitespace = (value: string) => value.replace(/\s+/g, ' ').trim();

const formatDateTime = (iso: string) =>
  new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(iso));

const formatDistance = (distanceMeters: number) => {
  if (distanceMeters >= 1000) {
    const kilometers = distanceMeters / 1000;
    const precision = kilometers >= 10 ? 0 : 1;
    return `${kilometers.toFixed(precision)} km away`;
  }
  return `${Math.round(distanceMeters)} m away`;
};

async function renderList(events: EventListItem[]): Promise<RenderResult> {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);

  await act(async () => {
    root.render(<EventListView events={events} />);
  });

  const listItems = Array.from(host.querySelectorAll('ul[aria-label="Nearby events"] > li')) as HTMLLIElement[];

  return {
    listItems,
    cleanup: async () => {
      await act(async () => {
        root.unmount();
      });
      host.remove();
    },
  };
}

describe('Property 22: List View Required Fields', () => {
  it('renders the title, datetime, location name, and distance for each event', async () => {
    await fc.assert(
      fc.asyncProperty(eventsArrayArb, async (events) => {
        const { listItems, cleanup } = await renderList(events);

        try {
          expect(listItems).toHaveLength(events.length);

          events.forEach((event, index) => {
            const content = normalizeWhitespace(listItems[index].textContent ?? '');
            const expectedTitle = normalizeWhitespace(event.title);
            const expectedLocation = normalizeWhitespace(event.locationName);
            const expectedDate = formatDateTime(event.datetimeISO!);
            const expectedDistance = formatDistance(event.distanceMeters!);

            expect(content).toContain(expectedTitle);
            expect(content).toContain(expectedLocation);
            expect(content).toContain(expectedDate);
            expect(content).toContain(expectedDistance);
          });
        } finally {
          await cleanup();
        }
      }),
      { numRuns: 75 }
    );
  });
});
