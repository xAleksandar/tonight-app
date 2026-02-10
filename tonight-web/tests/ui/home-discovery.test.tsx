import { JSDOM } from 'jsdom';
import React from 'react';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import HomePage from '@/app/page';

type TestingLibrary = typeof import('@testing-library/react');

let render: TestingLibrary['render'];
let screen: TestingLibrary['screen'];
let waitFor: TestingLibrary['waitFor'];
let fireEvent: TestingLibrary['fireEvent'];
let cleanup: TestingLibrary['cleanup'];

const ensureDomGlobals = () => {
  if (typeof document !== 'undefined') {
    return;
  }

  jsdomInstance = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://tonight.test' });
  const { window } = jsdomInstance;

  Object.defineProperties(globalThis, {
    window: { configurable: true, value: window, writable: true },
    document: { configurable: true, value: window.document, writable: true },
    navigator: { configurable: true, value: window.navigator, writable: true },
    HTMLElement: { configurable: true, value: window.HTMLElement, writable: true },
  });
};

const mockPush = vi.fn();
const mockReplace = vi.fn();
let currentSearchParams = new URLSearchParams();
const useRequireAuthMock = vi.fn(() => ({ status: 'authenticated' as const }));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  usePathname: () => '/',
  useSearchParams: () => currentSearchParams,
}));

vi.mock('@/hooks/useRequireAuth', () => ({
  useRequireAuth: () => useRequireAuthMock(),
}));

vi.mock('@/components/EventMapView', () => {
  const MockMap = ({ events }: { events: Array<Record<string, unknown>> }) => (
    <div data-testid="event-map-view">Map with {events.length} events</div>
  );
  return {
    __esModule: true,
    default: MockMap,
  };
});

const originalFetch = global.fetch;
let originalMatchMedia: typeof window.matchMedia | undefined;
let originalGeolocation: Geolocation | undefined;
let jsdomInstance: JSDOM | null = null;

const locationCoords = { latitude: 37.7749, longitude: -122.4194 };

const sampleEvents = [
  {
    id: 'evt-cinema',
    title: 'Sunset Cinema on the Roof',
    description: 'Movie marathon with rooftop vibes',
    datetime: new Date('2024-07-10T20:00:00Z').toISOString(),
    locationName: 'Mission Rooftop',
    maxParticipants: 20,
    distanceMeters: 1500,
    location: { ...locationCoords },
    host: {
      id: 'host-marco',
      displayName: 'Marco R.',
      photoUrl: null,
      initials: 'MR',
    },
    availability: {
      maxParticipants: 20,
      acceptedCount: 19,
      spotsRemaining: 1,
    },
  },
  {
    id: 'evt-social',
    title: 'Downtown Coffee Crawl',
    description: 'Meet locals for a cafe hop and board games',
    datetime: new Date('2024-07-11T10:00:00Z').toISOString(),
    locationName: 'Union Square',
    maxParticipants: 12,
    distanceMeters: 800,
    location: { ...locationCoords },
    host: {
      id: 'host-elena',
      displayName: 'Elena K.',
      photoUrl: null,
      initials: 'EK',
    },
    availability: {
      maxParticipants: 12,
      acceptedCount: 10,
      spotsRemaining: 2,
    },
  },
  {
    id: 'evt-music',
    title: 'Midnight Jazz Session',
    description: 'Late-night improv set with local artists',
    datetime: new Date('2024-07-12T23:00:00Z').toISOString(),
    locationName: 'Hayes Valley Loft',
    maxParticipants: 30,
    distanceMeters: 2300,
    location: { ...locationCoords },
    host: {
      id: 'host-sofia',
      displayName: 'Sofia M.',
      photoUrl: null,
      initials: 'SM',
    },
    availability: {
      maxParticipants: 30,
      acceptedCount: 25,
      spotsRemaining: 5,
    },
  },
];

const mockFetchSuccess = () =>
  vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      events: sampleEvents,
      meta: {
        latitude: locationCoords.latitude,
        longitude: locationCoords.longitude,
        radiusMeters: 10_000,
      },
    }),
  });

const installMatchMedia = () => {
  originalMatchMedia = window.matchMedia;
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('min-width: 768px'),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
};

const installGeolocation = () => {
  originalGeolocation = navigator.geolocation;
  const geoMock = {
    getCurrentPosition: vi.fn((success: PositionCallback) =>
      success({
        coords: {
          latitude: locationCoords.latitude,
          longitude: locationCoords.longitude,
          accuracy: 5,
          altitude: null,
          altitudeAccuracy: null,
          heading: null,
          speed: null,
        },
        timestamp: Date.now(),
      })
    ),
    watchPosition: vi.fn(),
    clearWatch: vi.fn(),
  } as unknown as Geolocation;

  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: geoMock,
  });

  return geoMock;
};

beforeAll(async () => {
  ensureDomGlobals();
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  await import('@testing-library/jest-dom/vitest');
  const testingLibrary = await import('@testing-library/react');
  render = testingLibrary.render;
  screen = testingLibrary.screen;
  waitFor = testingLibrary.waitFor;
  fireEvent = testingLibrary.fireEvent;
  cleanup = testingLibrary.cleanup;
});

afterAll(() => {
  if (jsdomInstance) {
    jsdomInstance.window.close();
    jsdomInstance = null;
  }
  if (originalMatchMedia) {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: originalMatchMedia,
    });
  } else {
    delete (window as Partial<Window>).matchMedia;
  }

  if (originalGeolocation) {
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: originalGeolocation,
    });
  } else {
    delete (navigator as Partial<Navigator>).geolocation;
  }

  global.fetch = originalFetch;
});

beforeEach(() => {
  document.body.innerHTML = '';
  useRequireAuthMock.mockReturnValue({ status: 'authenticated' });
  currentSearchParams = new URLSearchParams();
  global.fetch = mockFetchSuccess() as unknown as typeof fetch;
  installMatchMedia();
  installGeolocation();
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.clear();
  }
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('HomePage authentication states', () => {
  it.each([
    { status: 'loading', label: 'Checking your session…' },
    { status: 'unauthenticated', label: 'Redirecting you to the welcome screen…' },
    { status: 'error', label: "We couldn't verify your session. Refresh to try again." },
  ])('renders status for $status', ({ status, label }) => {
    useRequireAuthMock.mockReturnValue({ status } as { status: 'loading' | 'unauthenticated' | 'error' });

    render(<HomePage />);

    expect(screen.getByText(label)).toBeInTheDocument();
  });
});

describe('Authenticated home/discovery experience', () => {
  it('renders the discovery hero and event list after location + fetch succeed', async () => {
    render(<HomePage />);

    await waitFor(() => expect(global.fetch).toHaveBeenCalled());

    const heroCopies = await screen.findAllByText(/events near you/i);
    expect(heroCopies.length).toBeGreaterThan(0);
    expect(screen.getByText('Live nearby meetups')).toBeInTheDocument();
    expect(screen.getByText('Sunset Cinema on the Roof')).toBeInTheDocument();
    expect(screen.getByText('Downtown Coffee Crawl')).toBeInTheDocument();
    expect(screen.getAllByText(/37\.7749, -122\.4194/)[0]).toBeInTheDocument();
    expect(screen.getByText('Marco R.')).toBeInTheDocument();
    expect(screen.getByText('Elena K.')).toBeInTheDocument();
    expect(screen.getByText(/1 spot left/i)).toBeInTheDocument();
  });

  it('filters events by category selection so only matching cards remain', async () => {
    render(<HomePage />);
    await screen.findByText('Downtown Coffee Crawl');

    const musicButtons = screen.getAllByRole('button', { name: /music/i });
    fireEvent.click(musicButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Midnight Jazz Session')).toBeInTheDocument();
      expect(screen.queryByText('Downtown Coffee Crawl')).not.toBeInTheDocument();
      expect(screen.queryByText('Sunset Cinema on the Roof')).not.toBeInTheDocument();
    });
  });

  it('switches to the map view when the toggle is pressed', async () => {
    render(<HomePage />);
    await screen.findByText('Sunset Cinema on the Roof');

    expect(screen.queryByTestId('event-map-view')).not.toBeInTheDocument();

    const mapButtons = screen.getAllByRole('button', { name: /^map$/i });
    fireEvent.click(mapButtons[mapButtons.length - 1]);

    expect(await screen.findByTestId('event-map-view')).toBeInTheDocument();
  });

  it('remembers the last selected view mode when revisiting the page', async () => {
    window.localStorage.setItem('tonight:view-mode', 'map');

    render(<HomePage />);

    expect(await screen.findByTestId('event-map-view')).toBeInTheDocument();
  });

  it('opens and closes the Messages modal from the discovery header tab', async () => {
    render(<HomePage />);
    await screen.findByText('Sunset Cinema on the Roof');

    const navMessageButton = screen
      .getAllByRole('button', { name: /messages/i })
      .find((button) => button.textContent?.toLowerCase().includes('messages'));

    expect(navMessageButton).toBeDefined();

    fireEvent.click(navMessageButton!);

    expect(await screen.findByRole('heading', { name: /messages/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /close messages/i }));

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: /messages/i })).not.toBeInTheDocument();
    });
  });
});
