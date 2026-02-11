// Shared types and constants for Socket.IO (can be imported by both client and server)

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
