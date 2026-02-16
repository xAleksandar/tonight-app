'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { DefaultEventsMap } from 'socket.io';
import { io, type Socket } from 'socket.io-client';

import {
  JOIN_REQUEST_JOIN_EVENT,
  JOIN_REQUEST_MESSAGE_EVENT,
  JOIN_REQUEST_STATUS_CHANGED_EVENT,
  CHAT_TYPING_START_EVENT,
  CHAT_TYPING_STOP_EVENT,
  CHAT_TYPING_EVENT,
  CHAT_TYPING_STOP_BROADCAST_EVENT,
  type SocketMessagePayload,
  type SocketTypingPayload,
  type JoinRequestStatusChangedPayload,
} from '@/lib/socket-shared';

export type SocketConnectionState = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'error';

type ClientSocket = Socket<DefaultEventsMap, DefaultEventsMap>;

type EventHandlers = {
  onMessage?: (payload: SocketMessagePayload) => void;
  onConnect?: () => void;
  onDisconnect?: (reason: string) => void;
  onError?: (error: Error) => void;
  onTyping?: (payload: SocketTypingPayload) => void;
  onTypingStop?: (payload: { joinRequestId: string; userId: string }) => void;
  onJoinRequestStatusChanged?: (payload: JoinRequestStatusChangedPayload) => void;
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
  sendTypingStart: (joinRequestId: string) => void;
  sendTypingStop: (joinRequestId: string) => void;
  /** Current retry attempt counter (0 when connected or idle) */
  reconnectAttempt: number;
  /** Milliseconds remaining before the next automatic reconnect attempt. Null when not scheduled. */
  nextRetryInMs: number | null;
};

const DEFAULT_SOCKET_READINESS_ENDPOINT = '/api/socket/io';
const RECONNECT_BASE_DELAY_MS = 1000;
const RECONNECT_MAX_DELAY_MS = 15000;

const isBrowserEnvironment = () => typeof window !== 'undefined';

const ensureServerReady = async (endpoint: string) => {
  try {
    await fetch(endpoint, { method: 'GET', credentials: 'include' });
  } catch (error) {
    console.error('Failed to prepare Socket.IO server', error);
  }
};

const normalizeJoinRequestId = (value: string) => value?.trim();

const getReconnectDelay = (attempt: number) => {
  if (attempt <= 0) {
    return RECONNECT_BASE_DELAY_MS;
  }
  const raw = RECONNECT_BASE_DELAY_MS * 2 ** (attempt - 1);
  return Math.min(raw, RECONNECT_MAX_DELAY_MS);
};

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
    onTyping,
    onTypingStop,
    onJoinRequestStatusChanged,
  } = options;

  const handlersRef = useRef<EventHandlers>({
    onMessage,
    onConnect,
    onDisconnect,
    onError,
    onTyping,
    onTypingStop,
    onJoinRequestStatusChanged,
  });

  useEffect(() => {
    handlersRef.current = { onMessage, onConnect, onDisconnect, onError, onTyping, onTypingStop, onJoinRequestStatusChanged };
  }, [onMessage, onConnect, onDisconnect, onError, onTyping, onTypingStop, onJoinRequestStatusChanged]);

  const socketRef = useRef<ClientSocket | null>(null);
  const joinedRoomsRef = useRef<Set<string>>(new Set());
  const tokenRef = useRef<string | null>(token ?? null);
  const isMountedRef = useRef(true);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimerRef = useRef<number | null>(null);
  const reconnectCountdownIntervalRef = useRef<number | null>(null);
  const manualDisconnectRef = useRef(false);
  const startConnectionRef = useRef<(({ isRetry }?: { isRetry?: boolean }) => Promise<void>) | undefined>(undefined);

  const [connectionState, setConnectionState] = useState<SocketConnectionState>('idle');
  const [error, setError] = useState<Error | null>(null);
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  const [nextRetryInMs, setNextRetryInMs] = useState<number | null>(null);

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
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (reconnectCountdownIntervalRef.current) {
        clearInterval(reconnectCountdownIntervalRef.current);
        reconnectCountdownIntervalRef.current = null;
      }
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
      if (nextState === 'connected' || nextState === 'idle') {
        setNextRetryInMs(null);
        setReconnectAttempt(0);
      }
    },
    []
  );

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  const clearReconnectCountdown = useCallback(() => {
    if (reconnectCountdownIntervalRef.current) {
      clearInterval(reconnectCountdownIntervalRef.current);
      reconnectCountdownIntervalRef.current = null;
    }
  }, []);

  const resetReconnectTracking = useCallback(() => {
    reconnectAttemptsRef.current = 0;
    setReconnectAttempt(0);
    setNextRetryInMs(null);
    clearReconnectTimer();
    clearReconnectCountdown();
  }, [clearReconnectCountdown, clearReconnectTimer]);

  const flushQueuedRoomJoins = useCallback((socket: ClientSocket) => {
    joinedRoomsRef.current.forEach((roomId) => {
      socket.emit(JOIN_REQUEST_JOIN_EVENT, roomId);
    });
  }, []);

  const scheduleReconnect = useCallback(() => {
    if (!isBrowserEnvironment()) {
      return;
    }

    if (!tokenRef.current) {
      updateState('idle');
      return;
    }

    const nextAttempt = reconnectAttemptsRef.current + 1;
    reconnectAttemptsRef.current = nextAttempt;
    setReconnectAttempt(nextAttempt);

    const delay = getReconnectDelay(nextAttempt);
    updateState('reconnecting');
    setNextRetryInMs(delay);

    clearReconnectTimer();
    clearReconnectCountdown();

    const targetTimestamp = Date.now() + delay;
    reconnectCountdownIntervalRef.current = window.setInterval(() => {
      const remaining = Math.max(targetTimestamp - Date.now(), 0);
      setNextRetryInMs(remaining);
      if (remaining <= 0) {
        clearReconnectCountdown();
      }
    }, 200);

    reconnectTimerRef.current = window.setTimeout(() => {
      clearReconnectTimer();
      clearReconnectCountdown();
      setNextRetryInMs(null);
      const attemptConnection = startConnectionRef.current;
      if (attemptConnection) {
        void attemptConnection({ isRetry: true });
      }
    }, delay);
  }, [clearReconnectCountdown, clearReconnectTimer, updateState]);

  const attachSocketListeners = useCallback(
    (socket: ClientSocket) => {
      socket.on('connect', () => {
        manualDisconnectRef.current = false;
        resetReconnectTracking();
        updateState('connected');
        flushQueuedRoomJoins(socket);
        handlersRef.current.onConnect?.();
      });

      socket.on('disconnect', (reason) => {
        const normalizedReason = typeof reason === 'string' ? reason : 'disconnect';
        handlersRef.current.onDisconnect?.(normalizedReason);

        if (manualDisconnectRef.current) {
          manualDisconnectRef.current = false;
          updateState('idle');
          return;
        }

        scheduleReconnect();
      });

      socket.on('connect_error', (err: Error) => {
        updateState('error', err);
        handlersRef.current.onError?.(err);
        scheduleReconnect();
      });

      socket.on(JOIN_REQUEST_MESSAGE_EVENT, (payload: SocketMessagePayload) => {
        handlersRef.current.onMessage?.(payload);
      });

      socket.on(CHAT_TYPING_EVENT, (payload: SocketTypingPayload) => {
        handlersRef.current.onTyping?.(payload);
      });

      socket.on(CHAT_TYPING_STOP_BROADCAST_EVENT, (payload: { joinRequestId: string; userId: string }) => {
        handlersRef.current.onTypingStop?.(payload);
      });

      socket.on(JOIN_REQUEST_STATUS_CHANGED_EVENT, (payload: JoinRequestStatusChangedPayload) => {
        handlersRef.current.onJoinRequestStatusChanged?.(payload);
      });
    },
    [flushQueuedRoomJoins, resetReconnectTracking, scheduleReconnect, updateState]
  );

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

  const startConnection = useCallback(
    async ({ isRetry = false }: { isRetry?: boolean } = {}) => {
      if (!isBrowserEnvironment()) {
        return;
      }

      if (!tokenRef.current) {
        const missingTokenError = new Error('Missing authentication token for socket connection');
        updateState('error', missingTokenError);
        handlersRef.current.onError?.(missingTokenError);
        return;
      }

      if (!isRetry) {
        resetReconnectTracking();
      }

      const socket = getOrCreateSocket();
      socket.auth = { ...(socket.auth ?? {}), token: tokenRef.current };

      if (socket.connected || connectionState === 'connecting') {
        return;
      }

      manualDisconnectRef.current = false;
      updateState('connecting');

      await ensureServerReady(readinessEndpoint);

      socket.connect();
    },
    [connectionState, getOrCreateSocket, readinessEndpoint, resetReconnectTracking, updateState]
  );

  startConnectionRef.current = startConnection;
  useEffect(() => {
    startConnectionRef.current = startConnection;
  }, [startConnection]);

  const publicConnect = useCallback(async () => {
    await startConnection({ isRetry: false });
  }, [startConnection]);

  const disconnect = useCallback(() => {
    manualDisconnectRef.current = true;
    joinedRoomsRef.current.clear();
    clearReconnectTimer();
    clearReconnectCountdown();
    resetReconnectTracking();
    socketRef.current?.removeAllListeners();
    socketRef.current?.disconnect();
    socketRef.current = null;
    updateState('idle');
  }, [clearReconnectCountdown, clearReconnectTimer, resetReconnectTracking, updateState]);

  const joinRoom = useCallback((joinRequestId: string) => {
    const normalized = normalizeJoinRequestId(joinRequestId);
    if (!normalized) {
      return;
    }

    if (joinedRoomsRef.current.has(normalized) && socketRef.current?.connected) {
      return;
    }

    joinedRoomsRef.current.add(normalized);
    const socket = socketRef.current;
    if (socket && socket.connected) {
      socket.emit(JOIN_REQUEST_JOIN_EVENT, normalized);
    }
  }, []);

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

  const sendTypingStart = useCallback((joinRequestId: string) => {
    if (!socketRef.current?.connected) return;
    socketRef.current.emit(CHAT_TYPING_START_EVENT, { joinRequestId });
  }, []);

  const sendTypingStop = useCallback((joinRequestId: string) => {
    if (!socketRef.current?.connected) return;
    socketRef.current.emit(CHAT_TYPING_STOP_EVENT, { joinRequestId });
  }, []);

  useEffect(() => {
    if (autoConnect && token) {
      void publicConnect();
    }
  }, [autoConnect, publicConnect, token]);

  return {
    socket: socketRef.current,
    connectionState,
    error,
    isConnected: connectionState === 'connected',
    connect: publicConnect,
    disconnect,
    joinRoom,
    sendMessage,
    sendTypingStart,
    sendTypingStop,
    reconnectAttempt,
    nextRetryInMs,
  };
};
