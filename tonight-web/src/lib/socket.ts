import type { Server as HTTPServer } from 'node:http';
import { Server as SocketIOServer, type Socket, type ServerOptions, type DefaultEventsMap } from 'socket.io';

import { verifyJWT } from '@/lib/auth';

export const JOIN_REQUEST_ROOM_PREFIX = 'join-request:' as const;
export const JOIN_REQUEST_MESSAGE_EVENT = 'join-request:message' as const;
export const JOIN_REQUEST_JOIN_EVENT = 'join-request:join' as const;

export type SocketMessagePayload = {
  id: string;
  joinRequestId: string;
  senderId: string;
  content: string;
  createdAt: string;
};

type SocketData = {
  userId?: string;
};

type AuthenticatedSocket = Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, SocketData>;

class SocketService {
  private static instance: SocketService;

  private io?: SocketIOServer;
  private httpServer?: HTTPServer;

  private constructor() {}

  public static getInstance(): SocketService {
    if (!SocketService.instance) {
      SocketService.instance = new SocketService();
    }
    return SocketService.instance;
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
    this.configure(this.io);
    return this.io;
  }

  public getIO(): SocketIOServer {
    if (!this.io) {
      throw new Error('Socket.IO server has not been initialized');
    }
    return this.io;
  }

  public emitMessage(joinRequestId: string, payload: SocketMessagePayload): void {
    if (!joinRequestId) {
      throw new Error('joinRequestId is required');
    }
    this.getIO().to(this.getRoomName(joinRequestId)).emit(JOIN_REQUEST_MESSAGE_EVENT, payload);
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
