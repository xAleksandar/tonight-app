import { JSDOM } from 'jsdom';
import React from 'react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { EventInsideExperience, type EventInsideExperienceProps } from '@/components/tonight/event-inside/EventInsideExperience';

vi.mock('@/lib/toast', () => ({
  showSuccessToast: vi.fn(),
  showErrorToast: vi.fn(),
}));

const joinRoomMock = vi.fn();
let lastSocketOptions: { onMessage?: ((payload: any) => void) | undefined } | null = null;

vi.mock('@/hooks/useSocket', () => ({
  useSocket: (options: any) => {
    lastSocketOptions = options;
    return {
      socket: null,
      connectionState: 'connected',
      error: null,
      isConnected: true,
      connect: vi.fn(),
      disconnect: vi.fn(),
      joinRoom: joinRoomMock,
      sendMessage: vi.fn(),
      sendTypingStart: vi.fn(),
      sendTypingStop: vi.fn(),
      reconnectAttempt: 0,
      nextRetryInMs: null,
    };
  },
}));

type TestingLibrary = typeof import('@testing-library/react');

let render: TestingLibrary['render'];
let screen: TestingLibrary['screen'];
let cleanup: TestingLibrary['cleanup'];
let fireEvent: TestingLibrary['fireEvent'];
let waitFor: TestingLibrary['waitFor'];
let within: TestingLibrary['within'];
let act: TestingLibrary['act'];

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
  fireEvent = testingLibrary.fireEvent;
  waitFor = testingLibrary.waitFor;
  within = testingLibrary.within;
  act = testingLibrary.act;
});

afterAll(() => {
  if (jsdomInstance) {
    jsdomInstance.window.close();
    jsdomInstance = null;
  }
  // Keep the globals around so async React work after tests doesn't explode.
});

describe('EventInsideExperience', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  afterEach(() => {
    cleanup();
    joinRoomMock.mockClear();
    lastSocketOptions = null;
    vi.restoreAllMocks();
    if ('fetch' in globalThis) {
      // Tests that mock fetch can leave it dangling; remove between runs.
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete (globalThis as any).fetch;
    }
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

  it('lets hosts clear unread threads inline without opening chat', async () => {
    const props: EventInsideExperienceProps = {
      ...baseProps,
      chatPreview: {
        ...baseProps.chatPreview!,
        hostUnreadThreads: [
          {
            joinRequestId: 'jr-thread-1',
            displayName: 'Lena',
            lastMessageSnippet: 'Need directions',
            lastMessageAtISO: new Date().toISOString(),
            unreadCount: 1,
          },
        ],
      },
    };

    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    (globalThis as any).fetch = fetchMock;

    render(<EventInsideExperience {...props} />);

    const button = screen.getByRole('button', { name: /mark as read/i });
    fireEvent.click(button);

    expect(fetchMock).toHaveBeenCalledWith('/api/chat/jr-thread-1/mark-read', { method: 'POST' });

    await waitFor(() => {
      expect(screen.queryByText(/Guests needing replies/i)).not.toBeInTheDocument();
    });
  });

  it('lets hosts send quick replies without opening chat', async () => {
    const props: EventInsideExperienceProps = {
      ...baseProps,
      chatPreview: {
        ...baseProps.chatPreview!,
        hostUnreadThreads: [
          {
            joinRequestId: 'jr-thread-quick',
            displayName: 'Marco',
            lastMessageSnippet: 'Can you remind me of the buzzer?',
            lastMessageAtISO: new Date().toISOString(),
            unreadCount: 1,
          },
        ],
      },
    };

    const fetchMock = vi.fn().mockResolvedValue({ ok: true, text: vi.fn() });
    (globalThis as any).fetch = fetchMock;

    render(<EventInsideExperience {...props} />);

    const quickReplyButton = screen.getByRole('button', { name: /on my way/i });
    fireEvent.click(quickReplyButton);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/chat/jr-thread-quick/messages', expect.objectContaining({ method: 'POST' }));
    });
    expect(fetchMock).toHaveBeenCalledWith('/api/chat/jr-thread-quick/mark-read', expect.objectContaining({ method: 'POST' }));

    await waitFor(() => {
      expect(screen.queryByText(/Guests needing replies/i)).not.toBeInTheDocument();
    });
  });

  it('lets hosts publish announcements to all guests', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    (globalThis as any).fetch = fetchMock;

    render(<EventInsideExperience {...baseProps} />);

    const textarea = screen.getByPlaceholderText(/post an announcement/i);
    fireEvent.change(textarea, { target: { value: 'Doors open at 9:15 — grab a drink downstairs first.' } });

    const publishButton = screen.getByRole('button', { name: /publish announcement/i });
    fireEvent.click(publishButton);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/events/evt-123/host-activity', expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
      }));
    });

    await waitFor(() => {
      expect(textarea).toHaveValue('');
    });
  });

  it('lets hosts send custom replies from the inline composer', async () => {
    const props: EventInsideExperienceProps = {
      ...baseProps,
      chatPreview: {
        ...baseProps.chatPreview!,
        hostUnreadThreads: [
          {
            joinRequestId: 'jr-thread-inline',
            displayName: 'Sonia',
            lastMessageSnippet: 'Could you share the door code?',
            lastMessageAtISO: new Date().toISOString(),
            unreadCount: 3,
          },
        ],
      },
    };

    const fetchMock = vi.fn().mockResolvedValue({ ok: true, text: vi.fn() });
    (globalThis as any).fetch = fetchMock;

    render(<EventInsideExperience {...props} />);

    const composer = screen.getByPlaceholderText(/type a custom reply/i);
    fireEvent.change(composer, { target: { value: 'Here you go — dial 32 and I will buzz you up.' } });

    const sendButton = screen.getByRole('button', { name: /send reply/i });
    fireEvent.click(sendButton);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/chat/jr-thread-inline/messages', expect.objectContaining({ method: 'POST' }));
    });
    expect(fetchMock).toHaveBeenCalledWith('/api/chat/jr-thread-inline/mark-read', expect.objectContaining({ method: 'POST' }));

    await waitFor(() => {
      expect(screen.queryByText(/Guests needing replies/i)).not.toBeInTheDocument();
    });
  });

  it('renders the guest inline composer when metadata is provided', () => {
    const props: EventInsideExperienceProps = {
      ...baseProps,
      viewerRole: 'guest',
      joinRequests: [],
      chatPreview: {
        ...baseProps.chatPreview!,
        hostUnreadThreads: undefined,
        guestComposer: {
          joinRequestId: 'jr-guest-1',
        },
      },
    };

    render(<EventInsideExperience {...props} />);

    expect(screen.getByText(/message the host/i)).toBeInTheDocument();
    const textarea = screen.getByPlaceholderText(/share an update/i);
    expect(textarea).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send message/i })).toBeDisabled();
  });

  it('lets guests send a message from the inline composer', async () => {
    const props: EventInsideExperienceProps = {
      ...baseProps,
      viewerRole: 'guest',
      joinRequests: [],
      chatPreview: {
        ...baseProps.chatPreview!,
        hostUnreadThreads: undefined,
        guestComposer: {
          joinRequestId: 'jr-guest-send',
        },
      },
    };

    const fetchMock = vi.fn().mockResolvedValue({ ok: true, text: vi.fn() });
    (globalThis as any).fetch = fetchMock;

    render(<EventInsideExperience {...props} />);

    const textarea = screen.getByPlaceholderText(/share an update/i);
    fireEvent.change(textarea, { target: { value: 'See you at the venue in 10!' } });

    const sendButton = screen.getByRole('button', { name: /send message/i });
    fireEvent.click(sendButton);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/chat/jr-guest-send/messages', expect.objectContaining({ method: 'POST' }));
    });
    expect(fetchMock).toHaveBeenCalledWith('/api/chat/jr-guest-send/mark-read', expect.objectContaining({ method: 'POST' }));
  });

  it('surfaces the latest host update for guests when provided', () => {
    const props: EventInsideExperienceProps = {
      ...baseProps,
      viewerRole: 'guest',
      joinRequests: [],
      chatPreview: {
        ...baseProps.chatPreview!,
        hostUnreadThreads: undefined,
        latestHostActivity: {
          message: 'Doors open at 9',
          postedAtISO: new Date().toISOString(),
          authorName: 'Aleks',
        },
        guestComposer: {
          joinRequestId: 'jr-guest-latest',
        },
      },
    };

    render(<EventInsideExperience {...props} />);

    const latestUpdate = screen.getByText(/Latest host update/i);
    expect(latestUpdate).toBeInTheDocument();
    const updatePanel = latestUpdate.closest('div');
    expect(updatePanel).not.toBeNull();
    expect(within(updatePanel as HTMLElement).getByText(/Doors open at 9/i)).toBeInTheDocument();
  });

  it('renders a mini host activity feed when multiple updates exist', () => {
    const props: EventInsideExperienceProps = {
      ...baseProps,
      viewerRole: 'guest',
      joinRequests: [],
      chatPreview: {
        ...baseProps.chatPreview!,
        hostUnreadThreads: undefined,
        latestHostActivityFeed: [
          {
            id: 'msg-1',
            message: 'Doors open at 9',
            postedAtISO: new Date().toISOString(),
            authorName: 'Aleks',
          },
          {
            id: 'msg-2',
            message: 'Running 10 minutes behind but headed over now.',
            postedAtISO: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
            authorName: 'Aleks',
          },
        ],
        guestComposer: {
          joinRequestId: 'jr-guest-feed',
        },
      },
    };

    render(<EventInsideExperience {...props} />);

    const panel = screen.getByText(/Host updates/i).closest('div');
    expect(panel).not.toBeNull();
    const scoped = within(panel as HTMLElement);
    expect(scoped.getByText('Doors open at 9')).toBeInTheDocument();
    expect(scoped.getByText(/Running 10 minutes behind/i)).toBeInTheDocument();
  });

  it('loads earlier host updates when the pagination affordance is tapped', async () => {
    const props: EventInsideExperienceProps = {
      ...baseProps,
      viewerRole: 'guest',
      joinRequests: [],
      chatPreview: {
        ...baseProps.chatPreview!,
        latestHostActivityFeed: [
          {
            id: 'msg-1',
            message: 'Doors open at 9',
            postedAtISO: new Date().toISOString(),
            authorName: 'Aleks',
          },
        ],
        hostActivityFeedPagination: {
          hasMore: true,
          nextCursor: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
        },
        guestComposer: {
          joinRequestId: 'jr-guest-feed',
        },
      },
    };

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        updates: [
          {
            id: 'msg-older',
            message: 'Reminder about parking — use lot B.',
            postedAtISO: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
            authorName: 'Aleks',
          },
        ],
        hasMore: false,
        nextCursor: null,
      }),
    });
    (globalThis as any).fetch = fetchMock;

    render(<EventInsideExperience {...props} />);

    const button = screen.getByRole('button', { name: /see earlier updates/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });

    expect(await screen.findByText(/Reminder about parking/i)).toBeInTheDocument();
  });
  it('streams host announcements to guests in real time', async () => {
    const props: EventInsideExperienceProps = {
      ...baseProps,
      viewerRole: 'guest',
      joinRequests: [],
      chatPreview: {
        ...baseProps.chatPreview!,
        guestComposer: { joinRequestId: 'jr-guest-1' },
        latestHostActivityFeed: [
          {
            id: 'initial-host-update',
            message: 'Original update',
            postedAtISO: new Date().toISOString(),
            authorName: 'Aleks',
          },
        ],
        hostActivityFeedPagination: { hasMore: false, nextCursor: null },
      },
      socketToken: 'jwt-token',
    };

    render(<EventInsideExperience {...props} />);

    await waitFor(() => {
      expect(joinRoomMock).toHaveBeenCalledWith('jr-guest-1');
    });

    expect(screen.getByText(/Original update/i)).toBeInTheDocument();

    const payload = {
      id: 'announcement-1',
      joinRequestId: 'jr-guest-1',
      senderId: props.host.id,
      content: 'Doors now open — head upstairs.',
      createdAt: new Date().toISOString(),
    };

    await act(async () => {
      lastSocketOptions?.onMessage?.(payload);
    });

    expect(screen.getByText(/Doors now open/i)).toBeInTheDocument();

    await act(async () => {
      lastSocketOptions?.onMessage?.(payload);
    });

    expect(screen.getAllByText(/Doors now open/i)).toHaveLength(1);
  });

});
