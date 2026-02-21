import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import fc from 'fast-check';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import type MapboxLocationPickerComponent from '@/components/MapboxLocationPicker';
import type { MapboxLocationPickerProps, MapCoordinates } from '@/components/MapboxLocationPicker';
import type mapboxgl from 'mapbox-gl';

type MapEventHandler = (event?: unknown) => void;

type InteractionControls = {
  enable: ReturnType<typeof vi.fn>;
  disable: ReturnType<typeof vi.fn>;
};

const createInteractionControls = (): InteractionControls => ({
  enable: vi.fn(),
  disable: vi.fn(),
});

type RegisteredHandlers = Record<string, MapEventHandler[]>;

class MockMap {
  private zoom: number;
  private handlers: RegisteredHandlers = {};
  private canvas = { style: {} as Record<string, string> };

  public readonly scrollZoom = createInteractionControls();
  public readonly boxZoom = createInteractionControls();
  public readonly dragRotate = createInteractionControls();
  public readonly dragPan = createInteractionControls();
  public readonly keyboard = createInteractionControls();
  public readonly doubleClickZoom = createInteractionControls();
  public readonly touchZoomRotate = createInteractionControls();

  constructor(public readonly options: Record<string, unknown>) {
    this.zoom = typeof options.zoom === 'number' ? options.zoom : 0;
    mockMapInstances.push(this);
  }

  addControl = vi.fn();
  remove = vi.fn(() => {
    this.handlers = {};
  });
  flyTo = vi.fn((options: { center?: [number, number]; zoom?: number }) => {
    if (typeof options.zoom === 'number') {
      this.zoom = options.zoom;
    }
    return this;
  });
  getZoom = vi.fn(() => this.zoom);
  getCanvas = vi.fn(() => this.canvas);
  resize = vi.fn();
  setStyle = vi.fn();

  on(event: string, handler: MapEventHandler) {
    if (!this.handlers[event]) {
      this.handlers[event] = [];
    }
    this.handlers[event].push(handler);
    return this;
  }

  emit(event: string, payload?: unknown) {
    this.handlers[event]?.forEach((handler) => handler(payload));
  }
}

class MockMarker {
  constructor(public readonly options: Record<string, unknown>) {}

  setLngLat = vi.fn(() => this);
  addTo = vi.fn(() => this);
  remove = vi.fn();
}

class MockNavigationControl {
  constructor(public readonly options: Record<string, unknown>) {}
}

const mockMapInstances: MockMap[] = [];

const mockMapboxModule = {
  Map: MockMap,
  Marker: MockMarker,
  NavigationControl: MockNavigationControl,
  accessToken: '',
};

const mockMapboxLoader = async () => mockMapboxModule as unknown as typeof mapboxgl;

type MapboxLocationPickerComponentType = typeof MapboxLocationPickerComponent;
let MapboxLocationPicker: MapboxLocationPickerComponentType;
let jsdomInstance: JSDOM | null = null;

const ensureDomGlobals = () => {
  if (typeof document !== 'undefined') {
    return;
  }

  jsdomInstance = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://example.com' });
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
  process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN ?? 'test-token';
  MapboxLocationPicker = (await import('@/components/MapboxLocationPicker')).default;
});

afterEach(() => {
  document.body.innerHTML = '';
  mockMapInstances.length = 0;
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

const coordinateArb = fc.record({
  lat: fc.double({ min: -80, max: 80, noNaN: true }),
  lng: fc.double({ min: -170, max: 170, noNaN: true }),
});

const distinctCoordinatePairs = fc
  .tuple(coordinateArb, coordinateArb)
  .filter(([first, second]) => Math.abs(first.lat - second.lat) > 0.0001 || Math.abs(first.lng - second.lng) > 0.0001);

const formatCoordinate = (value: number) => value.toFixed(5);
const flushMicrotasks = () => new Promise((resolve) => setTimeout(resolve, 0));

const getLatestMapInstance = () => mockMapInstances.at(-1) ?? null;

type RenderResult = {
  container: HTMLDivElement;
  cleanup: () => Promise<void>;
  map: MockMap;
  getInstruction: () => string;
  getSummary: () => string;
};

async function renderPicker(props: Partial<MapboxLocationPickerProps> = {}): Promise<RenderResult> {
  if (!MapboxLocationPicker) {
    throw new Error('MapboxLocationPicker failed to load');
  }

  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  const onChange = (props.onChange as ReturnType<typeof vi.fn>) ?? vi.fn();
  const mapboxLoader = props.mapboxLoader ?? mockMapboxLoader;

  await act(async () => {
    root.render(<MapboxLocationPicker {...props} onChange={onChange} mapboxLoader={mapboxLoader} />);
  });

  await flushMicrotasks();

  const map = getLatestMapInstance();
  if (!map) {
    throw new Error('Mock Mapbox map was not initialized');
  }

  return {
    container: host,
    map,
    getInstruction: () => host.querySelector('[aria-live="polite"]')?.textContent ?? '',
    getSummary: () => host.querySelector('p.font-mono')?.textContent ?? '',
    cleanup: async () => {
      await act(async () => {
        root.unmount();
      });
      host.remove();
    },
  };
}

describe('Property 38: Map Click Coordinate Capture', () => {
  it('captures coordinates for sequential map clicks and updates selection summary', async () => {
    await fc.assert(
      fc.asyncProperty(distinctCoordinatePairs, async ([first, second]) => {
        const onChange = vi.fn();
        const { map, cleanup, getInstruction, getSummary } = await renderPicker({ onChange });

        try {
          await act(async () => {
            map.emit('load', { type: 'load' });
          });
          await flushMicrotasks();

          expect(getInstruction()).toContain('Click anywhere');
          expect(getSummary()).toBe('No location selected');

          await act(async () => {
            map.emit('click', { lngLat: first } as { lngLat: MapCoordinates });
          });
          await flushMicrotasks();

          expect(onChange).toHaveBeenCalledWith(first);
          expect(getSummary()).toBe(`${formatCoordinate(first.lat)}, ${formatCoordinate(first.lng)}`);
          expect(getInstruction()).toContain('Click a different spot');

          await act(async () => {
            map.emit('click', { lngLat: second } as { lngLat: MapCoordinates });
          });
          await flushMicrotasks();

          expect(onChange).toHaveBeenLastCalledWith(second);
          expect(getSummary()).toBe(`${formatCoordinate(second.lat)}, ${formatCoordinate(second.lng)}`);
        } finally {
          await cleanup();
        }
      }),
      { numRuns: 75 }
    );
  });
});
