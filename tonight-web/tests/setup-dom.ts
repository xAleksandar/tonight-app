import { JSDOM } from 'jsdom';

if (typeof window === 'undefined' || typeof document === 'undefined') {
  const jsdom = new JSDOM('<!doctype html><html><body></body></html>');
  const { window } = jsdom;

  Object.defineProperties(globalThis, {
    window: { configurable: true, value: window, writable: true },
    document: { configurable: true, value: window.document, writable: true },
    navigator: { configurable: true, value: window.navigator, writable: true },
  });
}
