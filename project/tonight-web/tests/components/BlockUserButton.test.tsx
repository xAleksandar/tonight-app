import { JSDOM } from 'jsdom';
import React from 'react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import BlockUserButton from '@/components/BlockUserButton';

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

describe('BlockUserButton', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    global.fetch = vi.fn() as unknown as typeof fetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    global.fetch = originalFetch;
  });

  it('opens the confirmation dialog and closes it on cancel', () => {
    render(<BlockUserButton targetUserId="user-123" targetDisplayName="Alex" />);

    const trigger = screen.getByRole('button', { name: /block/i });
    fireEvent.click(trigger);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('submits the block request and locks the button after success', async () => {
    const mockFetch = global.fetch as unknown as vi.Mock;
    const blockRecord = {
      id: 'block-1',
      blockerId: 'me',
      blockedId: 'user-123',
      createdAt: new Date().toISOString(),
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ block: blockRecord }),
    });

    const onBlocked = vi.fn();

    render(
      <BlockUserButton targetUserId="user-123" targetDisplayName="Maya" onBlocked={onBlocked} />
    );

    fireEvent.click(screen.getByRole('button', { name: /block/i }));
    fireEvent.click(screen.getByRole('button', { name: /block user/i }));

    await waitFor(() => {
      expect(onBlocked).toHaveBeenCalledWith(blockRecord);
    });

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/users/block',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ userId: 'user-123' }),
      })
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /blocked/i })).toBeDisabled();
    });

    expect(screen.getByText(/has been blocked/i)).toBeInTheDocument();
  });

  it('shows an error when the API call fails', async () => {
    const mockFetch = global.fetch as unknown as vi.Mock;
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'User already blocked' }),
    });

    render(<BlockUserButton targetUserId="user-789" />);

    fireEvent.click(screen.getByRole('button', { name: /block/i }));
    fireEvent.click(screen.getByRole('button', { name: /block user/i }));

    await waitFor(() => {
      expect(screen.getByText(/user already blocked/i)).toBeInTheDocument();
    });

    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
