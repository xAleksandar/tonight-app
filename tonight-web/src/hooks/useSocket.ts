'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { DefaultEventsMap } from 'socket.io';
import { io, type Socket } from 'socket.io-client';

import {
  JOIN_REQUEST_JOIN_EVENT,
  JOIN_REQUEST_MESSAGE_EVENT,
  type SocketMessagePayload,
} from '@/lib/socket';

export type SocketConnectionState = 'idle' | 'connecting' | 'connected' | 'error';

type ClientSocket = Socket<DefaultEventsMap, DefaultEventsMap>;

type EventHandlers = {
  onMessage?: (payload: SocketMessagePayload) => void;
  onConnect?: () => void;
  onDisconnect?: (reason: string) => void;
  onError?: (error: Error) => void;
};

export type UseSocketOptions = EventHandlers & {
  /** JWT token returned from server-side auth helpers */
  token?: string | null;
  /** Optional explicit Socket.IO base URL (falls back to same-origin) */
  url?: string;
  /** Optional Socket.IO path (defaults to library default) */
  path?: string;
  /** Endpoint that prepares the Socket.IO server before connecting */
  readinessEndpoint?: string;
  /** Automatically attempt to connect when a token is present */
  autoConnect?: boolean;
};

export type UseSocketResult = {
  socket: ClientSocket | null;
  connectionState: SocketConnectionState;
  error: Error | null;
  isConnected: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
  joinRoom: (joinRequestId: string) => void;
  sendMessage: (joinRequestId: string, payload: Omit<SocketMessagePayload, 'joinRequestId'>) => void;
};

const DEFAULT_SOCKET_READINESS_ENDPOINT = '/api/socket/io';

const isBrowserEnvironment = () => typeof window !== 'undefined';

const ensureServerReady = async (endpoint: string) => {
  try {
    await fetch(endpoint, { method: 'GET', credentials: 'include' });
  } catch (error) {
    console.error('Failed to prepare Socket.IO server', error);
  }
};

const normalizeJoinRequestId = (value: string) => value?.trim();

export const useSocket = (options: UseSocketOptions): UseSocketResult => {
  const {
    token,
    url,
    path,
    readinessEndpoint = DEFAULT_SOCKET_READINESS_ENDPOINT,
    autoConnect = true,
    onMessage,
    onConnect,
    onDisconnect,
    onError,
  } = options;

  const handlersRef = useRef<EventHandlers>({
    onMessage,
    onConnect,
    onDisconnect,
    onError,
  });

  useEffect(() => {
    handlersRef.current = { onMessage, onConnect, onDisconnect, onError };
  }, [onMessage, onConnect, onDisconnect, onError]);

  const socketRef = useRef<ClientSocket | null>(null);
  const joinedRoomsRef = useRef<Set<string>>(new Set());
  const tokenRef = useRef<string | null>(token ?? null);
  const isMountedRef = useRef(true);

  const [connectionState, setConnectionState] = useState<SocketConnectionState>('idle');
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    tokenRef.current = token ?? null;
    if (!token) {
      joinedRoomsRef.current.clear();
    }
  }, [token]);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      socketRef.current?.removeAllListeners();
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, []);

  const socketUrl = useMemo(() => {
    return url ?? process.env.NEXT_PUBLIC_SOCKET_URL ?? undefined;
  }, [url]);

  const resolvedPath = useMemo(() => {
    return path ?? process.env.NEXT_PUBLIC_SOCKET_PATH ?? undefined;
  }, [path]);

  const updateState = useCallback(
    (nextState: SocketConnectionState, nextError: Error | null = null) => {
      if (!isMountedRef.current) {
        return;
      }
      setConnectionState(nextState);
      setError(nextError);
    },
    []
  );

  const attachSocketListeners = useCallback((socket: ClientSocket) => {
    socket.on('connect', () => {
      updateState('connected');
      handlersRef.current.onConnect?.();
    });

    socket.on('disconnect', (reason) => {
      updateState('idle');
      handlersRef.current.onDisconnect?.(typeof reason === 'string' ? reason : 'disconnect');
    });

    socket.on('connect_error', (err: Error) => {
      updateState('error', err);
      handlersRef.current.onError?.(err);
    });

    socket.on(JOIN_REQUEST_MESSAGE_EVENT, (payload: SocketMessagePayload) => {
      handlersRef.current.onMessage?.(payload);
    });
  }, [updateState]);

  const getOrCreateSocket = useCallback(() => {
    let socket = socketRef.current;
    if (socket) {
      return socket;
    }

    const socketOptions: Parameters<typeof io>[1] = {
      autoConnect: false,
      transports: ['websocket', 'polling'],
      withCredentials: true,
      auth: tokenRef.current ? { token: tokenRef.current } : undefined,
    };

    if (resolvedPath) {
      socketOptions.path = resolvedPath;
    }

    socket = io(socketUrl, socketOptions);
    socketRef.current = socket;
    attachSocketListeners(socket);
    return socket;
  }, [attachSocketListeners, resolvedPath, socketUrl]);

  const connect = useCallback(async () => {
    if (!isBrowserEnvironment()) {
      return;
    }

    if (!tokenRef.current) {
      const missingTokenError = new Error('Missing authentication token for socket connection');
      updateState('error', missingTokenError);
      handlersRef.current.onError?.(missingTokenError);
      return;
    }

    const socket = getOrCreateSocket();
    socket.auth = { ...(socket.auth ?? {}), token: tokenRef.current };

    if (socket.connected || connectionState === 'connecting') {
      return;
    }

    updateState('connecting');

    await ensureServerReady(readinessEndpoint);

    socket.connect();
  }, [connectionState, getOrCreateSocket, readinessEndpoint, updateState]);

  const disconnect = useCallback(() => {
    joinedRoomsRef.current.clear();
    socketRef.current?.disconnect();
    updateState('idle');
  }, [updateState]);

  const joinRoom = useCallback(
    (joinRequestId: string) => {
      const normalized = normalizeJoinRequestId(joinRequestId);
      if (!normalized) {
        return;
      }

      if (joinedRoomsRef.current.has(normalized)) {
        return;
      }

      const socket = socketRef.current;
      if (!socket) {
        return;
      }

      socket.emit(JOIN_REQUEST_JOIN_EVENT, normalized);
      joinedRoomsRef.current.add(normalized);
    },
    []
  );

  const sendMessage = useCallback((joinRequestId: string, payload: Omit<SocketMessagePayload, 'joinRequestId'>) => {
    const normalized = normalizeJoinRequestId(joinRequestId);
    if (!normalized) {
      return;
    }

    socketRef.current?.emit(JOIN_REQUEST_MESSAGE_EVENT, {
      ...payload,
      joinRequestId: normalized,
    });
  }, []);

  useEffect(() => {
    if (autoConnect && token) {
      void connect();
    }
  }, [autoConnect, connect, token]);

  return {
    socket: socketRef.current,
    connectionState,
    error,
    isConnected: connectionState === 'connected',
    connect,
    disconnect,
    joinRoom,
    sendMessage,
  };
};
