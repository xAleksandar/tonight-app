import { JSDOM } from 'jsdom';
import React from 'react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import ReportModal, { type ReportTarget } from '@/components/ReportModal';

type TestingLibrary = typeof import('@testing-library/react');

let render: TestingLibrary['render'];
let screen: TestingLibrary['screen'];
let fireEvent: TestingLibrary['fireEvent'];
let waitFor: TestingLibrary['waitFor'];

const originalFetch = global.fetch;
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

beforeAll(async () => {
  ensureDomGlobals();
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  await import('@testing-library/jest-dom/vitest');
  const testingLibrary = await import('@testing-library/react');
  render = testingLibrary.render;
  screen = testingLibrary.screen;
  fireEvent = testingLibrary.fireEvent;
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
});

describe('ReportModal', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    global.fetch = vi.fn() as unknown as typeof fetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    global.fetch = originalFetch;
  });

  const baseEventTarget: ReportTarget = {
    type: 'event',
    eventId: 'event-123',
    eventTitle: 'Movie Night',
    hostName: 'Alex',
  };

  it('requires a reason before enabling submission', () => {
    render(<ReportModal isOpen target={baseEventTarget} />);

    const submitButton = screen.getByRole('button', { name: /submit report/i });
    expect(submitButton).toBeDisabled();

    fireEvent.click(screen.getByLabelText(/something feels unsafe/i));
    expect(screen.getByRole('button', { name: /submit report/i })).not.toBeDisabled();
  });

  it('submits an event report successfully', async () => {
    const mockFetch = global.fetch as unknown as vi.Mock;
    const report = { id: 'report-1' };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ report }),
    });

    const onSubmitted = vi.fn();

    render(<ReportModal isOpen target={baseEventTarget} onSubmitted={onSubmitted} />);

    fireEvent.click(screen.getByLabelText(/something feels unsafe/i));
    fireEvent.change(screen.getByLabelText(/add details/i), {
      target: { value: 'Saw suspicious behavior.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /submit report/i }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/reports',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('event-123'),
        })
      );
    });

    await waitFor(() => {
      expect(onSubmitted).toHaveBeenCalledWith(report);
      expect(screen.getByText(/thanks for letting us know/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /report sent/i })).toBeDisabled();
    });
  });

  it('shows an error when the API call fails', async () => {
    const mockFetch = global.fetch as unknown as vi.Mock;
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Choose a single target to report' }),
    });

    const userTarget: ReportTarget = {
      type: 'user',
      userId: 'user-9',
      displayName: 'Jordan',
    };

    render(<ReportModal isOpen target={userTarget} />);

    fireEvent.click(screen.getByLabelText(/spam or scam attempt/i));
    fireEvent.click(screen.getByRole('button', { name: /submit report/i }));

    await waitFor(() => {
      expect(screen.getByText(/choose a single target/i)).toBeInTheDocument();
      expect(mockFetch).toHaveBeenCalled();
    });
  });
});
