import { JSDOM } from 'jsdom';
import React from 'react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { DesktopSidebar } from '@/components/tonight/DesktopSidebar';

const routerPushMock = vi.fn();

vi.mock('next/navigation', () => ({
  usePathname: () => '/profile',
  useRouter: () => ({ push: routerPushMock }),
}));

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
});

describe('DesktopSidebar', () => {
  const noop = () => {};

  beforeEach(() => {
    document.body.innerHTML = '';
  });

  afterEach(() => {
    cleanup();
    routerPushMock.mockReset();
    vi.restoreAllMocks();
  });

  it('invokes navigation callbacks when the primary entries are clicked', () => {
    const onNavigateDiscover = vi.fn();
    const onNavigatePeople = vi.fn();
    const onNavigateMessages = vi.fn();

    render(
      <DesktopSidebar
        selectedCategory={null}
        onCategoryChange={noop}
        onCreate={noop}
        onNavigateDiscover={onNavigateDiscover}
        onNavigatePeople={onNavigatePeople}
        onNavigateMessages={onNavigateMessages}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /discover/i }));
    fireEvent.click(screen.getByRole('button', { name: /people nearby/i }));
    fireEvent.click(screen.getByRole('button', { name: /^messages$/i }));

    expect(onNavigateDiscover).toHaveBeenCalledTimes(1);
    expect(onNavigatePeople).toHaveBeenCalledTimes(1);
    expect(onNavigateMessages).toHaveBeenCalledTimes(1);
  });

  it('falls back to router navigation when callbacks are omitted', () => {
    render(
      <DesktopSidebar
        selectedCategory={null}
        onCategoryChange={noop}
        onCreate={noop}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /discover/i }));
    fireEvent.click(screen.getByRole('button', { name: /people nearby/i }));
    fireEvent.click(screen.getByRole('button', { name: /^messages$/i }));

    expect(routerPushMock).toHaveBeenNthCalledWith(1, '/');
    expect(routerPushMock).toHaveBeenNthCalledWith(2, '/people');
    expect(routerPushMock).toHaveBeenNthCalledWith(3, '/messages');
  });
});
