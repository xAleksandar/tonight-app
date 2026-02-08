/** @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useSocket } from '@/hooks/useSocket';
import { JOIN_REQUEST_MESSAGE_EVENT, JOIN_REQUEST_JOIN_EVENT } from '@/lib/socket';
import type { SocketMessagePayload } from '@/lib/socket';

type Listener = (...args: unknown[]) => void;

class MockSocket {
  public connected = false;
  public auth: Record<string, unknown> | undefined;
  public emittedEvents: Array<{ event: string; args: unknown[] }> = [];
  private listeners = new Map<string, Set<Listener>>();

  public on(event: string, handler: Listener) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler);
    return this;
  }

  public off(event: string, handler: Listener) {
    this.listeners.get(event)?.delete(handler);
    return this;
  }

  public removeAllListeners() {
    this.listeners.clear();
    return this;
  }

  public emit(event: string, ...args: unknown[]) {
    this.emittedEvents.push({ event, args });
    return this;
  }

  public trigger(event: string, ...args: unknown[]) {
    this.listeners.get(event)?.forEach((handler) => handler(...args));
  }

  public connect = vi.fn(() => {
    this.connected = true;
    this.trigger('connect');
    return this;
  });

  public disconnect = vi.fn((reason = 'io client disconnect') => {
    this.connected = false;
    this.trigger('disconnect', reason);
    return this;
  });
}

const mockSockets: MockSocket[] = [];
const ioMock = vi.fn(() => {
  const socket = new MockSocket();
  mockSockets.push(socket);
  return socket as unknown as typeof import('socket.io-client').Socket;
});

vi.mock('socket.io-client', () => ({
  io: (...args: unknown[]) => ioMock(...(args as Parameters<typeof ioMock>)),
}));

const getLastSocket = () => mockSockets[mockSockets.length - 1]!;

describe('useSocket', () => {
  beforeEach(() => {
    mockSockets.length = 0;
    ioMock.mockClear();
    global.fetch = vi.fn(() => Promise.resolve(new Response('{}', { status: 200 }))) as typeof fetch;
  });

  it('reports error when connecting without a token', async () => {
    const onError = vi.fn();
    const { result } = renderHook(() => useSocket({ token: null, autoConnect: false, onError }));

    await act(async () => {
      await result.current.connect();
    });

    expect(onError).toHaveBeenCalledTimes(1);
    expect(result.current.connectionState).toBe('error');
  });

  it('connects with provided token and prepares the server first', async () => {
    const { result } = renderHook(() => useSocket({ token: 'jwt-token', autoConnect: false }));

    await act(async () => {
      await result.current.connect();
    });

    expect(global.fetch).toHaveBeenCalledWith('/api/socket/io', { method: 'GET', credentials: 'include' });
    expect(ioMock).toHaveBeenCalledTimes(1);
    const socket = getLastSocket();
    expect(socket.connect).toHaveBeenCalled();
    expect(result.current.connectionState).toBe('connected');
  });

  it('joins socket rooms only once per joinRequestId', async () => {
    const { result } = renderHook(() => useSocket({ token: 'jwt-token', autoConnect: false }));

    await act(async () => {
      await result.current.connect();
    });

    const socket = getLastSocket();

    act(() => {
      result.current.joinRoom('abc');
      result.current.joinRoom('abc');
      result.current.joinRoom('abc ');
    });

    const joinEvents = socket.emittedEvents.filter((event) => event.event === JOIN_REQUEST_JOIN_EVENT);
    expect(joinEvents).toHaveLength(1);
    expect(joinEvents[0]?.args).toEqual(['abc']);
  });

  it('sends join request messages with joinRequestId injected', async () => {
    const { result } = renderHook(() => useSocket({ token: 'jwt-token', autoConnect: false }));

    await act(async () => {
      await result.current.connect();
    });

    const socket = getLastSocket();
    const payload: SocketMessagePayload = {
      id: 'msg-1',
      joinRequestId: 'placeholder',
      senderId: 'sender',
      content: 'hello',
      createdAt: new Date().toISOString(),
    };

    act(() => {
      result.current.sendMessage('jr-123', payload);
    });

    const events = socket.emittedEvents.filter((event) => event.event === JOIN_REQUEST_MESSAGE_EVENT);
    expect(events).toHaveLength(1);
    expect(events[0]?.args[0]).toEqual({ ...payload, joinRequestId: 'jr-123' });
  });

  it('invokes onMessage handler when server pushes new messages', async () => {
    const onMessage = vi.fn();
    const { result } = renderHook(() => useSocket({ token: 'jwt-token', autoConnect: false, onMessage }));

    await act(async () => {
      await result.current.connect();
    });

    const socket = getLastSocket();
    const incoming: SocketMessagePayload = {
      id: 'msg-2',
      joinRequestId: 'jr-abc',
      senderId: 'sender',
      content: 'Hey',
      createdAt: new Date().toISOString(),
    };

    act(() => {
      socket.trigger(JOIN_REQUEST_MESSAGE_EVENT, incoming);
    });

    expect(onMessage).toHaveBeenCalledWith(incoming);
  });
});
