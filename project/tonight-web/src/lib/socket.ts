import type { Server as HTTPServer } from 'node:http';
import { Server as SocketIOServer, type Socket, type ServerOptions, type DefaultEventsMap } from 'socket.io';

import { verifyJWT } from '@/lib/auth';
import {
  JOIN_REQUEST_ROOM_PREFIX,
  JOIN_REQUEST_MESSAGE_EVENT,
  JOIN_REQUEST_JOIN_EVENT,
  JOIN_REQUEST_READ_RECEIPT_EVENT,
  CHAT_TYPING_START_EVENT,
  CHAT_TYPING_STOP_EVENT,
  CHAT_TYPING_EVENT,
  CHAT_TYPING_STOP_BROADCAST_EVENT,
  type SocketMessagePayload,
  type SocketReadReceiptEventPayload,
} from '@/lib/socket-shared';

export type { SocketMessagePayload };

type SocketData = {
  userId?: string;
  displayName?: string;
  email?: string;
};

type AuthenticatedSocket = Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, SocketData>;

class SocketService {
  private io?: SocketIOServer;
  private httpServer?: HTTPServer;

  private constructor() {}

  public static getInstance(): SocketService {
    const globalSocket = globalThis as typeof globalThis & { __socketService?: SocketService };
    if (globalSocket.__socketService) {
      return globalSocket.__socketService;
    }
    const instance = new SocketService();
    globalSocket.__socketService = instance;
    return instance;
  }

  public initialize(server: HTTPServer): SocketIOServer {
    if (this.io) {
      if (this.httpServer && this.httpServer !== server) {
        throw new Error('Socket.IO server is already initialized with a different HTTP server instance');
      }
      return this.io;
    }

    const options: Partial<ServerOptions> = {
      cors: {
        origin: this.getCorsOrigins(),
        credentials: true,
      },
    };

    this.io = new SocketIOServer(server, options);
    this.httpServer = server;
    // Also store on globalThis so the io instance is accessible across module
    // contexts (e.g. App Router vs Pages Router in Next.js).
    (globalThis as typeof globalThis & { __socketIO?: SocketIOServer }).__socketIO = this.io;
    this.configure(this.io);
    return this.io;
  }

  public getIO(): SocketIOServer {
    const io = this.io ?? (globalThis as typeof globalThis & { __socketIO?: SocketIOServer }).__socketIO;
    if (!io) {
      throw new Error('Socket.IO server has not been initialized');
    }
    return io;
  }

  private isInitialized(): boolean {
    return this.io !== undefined || (globalThis as typeof globalThis & { __socketIO?: SocketIOServer }).__socketIO !== undefined;
  }

  public emitMessage(joinRequestId: string, payload: SocketMessagePayload): void {
    if (!joinRequestId) {
      throw new Error('joinRequestId is required');
    }
    if (!this.isInitialized()) {
      console.warn('[SocketService] Cannot emit message: Socket.IO not initialized');
      return;
    }
    this.getIO().to(this.getRoomName(joinRequestId)).emit(JOIN_REQUEST_MESSAGE_EVENT, payload);
  }

  public emitReadReceipt(payload: SocketReadReceiptEventPayload): void {
    if (!payload.joinRequestId) {
      throw new Error('joinRequestId is required for read receipt events');
    }
    if (!this.isInitialized()) {
      console.warn('[SocketService] Cannot emit read receipt: Socket.IO not initialized');
      return;
    }
    this.getIO().to(this.getRoomName(payload.joinRequestId)).emit(JOIN_REQUEST_READ_RECEIPT_EVENT, payload);
  }

  private configure(io: SocketIOServer): void {
    io.use(async (socket, next) => {
      try {
        const token = this.extractToken(socket);
        if (!token) {
          next(new Error('Authentication token is required'));
          return;
        }

        const { userId } = await verifyJWT(token);
        socket.data.userId = userId;
        next();
      } catch (error) {
        next(new Error('Invalid authentication token'));
      }
    });

    io.on('connection', (socket) => {
      socket.on(JOIN_REQUEST_JOIN_EVENT, (joinRequestId: unknown) => {
        try {
          this.handleRoomJoin(socket, joinRequestId);
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unable to join room';
          socket.emit('error', message);
        }
      });

      // Typing indicator events
      socket.on(CHAT_TYPING_START_EVENT, ({ joinRequestId }: { joinRequestId: string }) => {
        if (!socket.data?.userId) return;

        const roomName = this.getRoomName(joinRequestId);

        // Broadcast to other users in the room (not sender)
        socket.to(roomName).emit(CHAT_TYPING_EVENT, {
          joinRequestId,
          userId: socket.data.userId,
          displayName: socket.data.displayName || socket.data.email?.split('@')[0] || 'User'
        });
      });

      socket.on(CHAT_TYPING_STOP_EVENT, ({ joinRequestId }: { joinRequestId: string }) => {
        if (!socket.data?.userId) return;

        const roomName = this.getRoomName(joinRequestId);

        // Broadcast to other users in the room (not sender)
        socket.to(roomName).emit(CHAT_TYPING_STOP_BROADCAST_EVENT, {
          joinRequestId,
          userId: socket.data.userId
        });
      });
    });
  }

  private handleRoomJoin(socket: AuthenticatedSocket, joinRequestId: unknown): void {
    if (typeof joinRequestId !== 'string' || !joinRequestId.trim()) {
      throw new Error('joinRequestId must be a non-empty string');
    }

    socket.join(this.getRoomName(joinRequestId));
  }

  private getRoomName(joinRequestId: string): string {
    return `${JOIN_REQUEST_ROOM_PREFIX}${joinRequestId}`;
  }

  private extractToken(socket: AuthenticatedSocket): string | undefined {
    const authToken = socket.handshake.auth?.token;
    const tokenFromAuth = this.normalizeTokenValue(authToken);
    if (tokenFromAuth) {
      return tokenFromAuth;
    }

    const queryToken = socket.handshake.query?.token;
    const tokenFromQuery = this.normalizeTokenValue(queryToken);
    if (tokenFromQuery) {
      return tokenFromQuery;
    }

    const header = socket.handshake.headers['authorization'];
    if (typeof header === 'string') {
      const [scheme, value] = header.split(' ');
      if (scheme === 'Bearer' && value) {
        return value;
      }
    }

    return undefined;
  }

  private normalizeTokenValue(value: unknown): string | undefined {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value;
    }

    if (Array.isArray(value)) {
      const first = value.find((entry) => typeof entry === 'string' && entry.trim().length > 0);
      return first;
    }

    return undefined;
  }

  private getCorsOrigins(): string[] {
    const explicitOrigins = process.env.SOCKET_IO_ALLOWED_ORIGINS;
    if (explicitOrigins && explicitOrigins.trim().length > 0) {
      return explicitOrigins.split(',').map((origin) => origin.trim()).filter(Boolean);
    }

    const defaultOrigin = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
    return [defaultOrigin];
  }
}

export const socketService = SocketService.getInstance();
