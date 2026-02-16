// Shared types and constants for Socket.IO (can be imported by both client and server)

export const JOIN_REQUEST_ROOM_PREFIX = 'join-request:' as const;
export const JOIN_REQUEST_MESSAGE_EVENT = 'join-request:message' as const;
export const JOIN_REQUEST_JOIN_EVENT = 'join-request:join' as const;

// Typing indicator events
export const CHAT_TYPING_START_EVENT = 'chat:typing_start' as const;
export const CHAT_TYPING_STOP_EVENT = 'chat:typing_stop' as const;
export const CHAT_TYPING_EVENT = 'chat:typing' as const;
export const CHAT_TYPING_STOP_BROADCAST_EVENT = 'chat:typing_stop' as const;

// Join request status change event
export const JOIN_REQUEST_STATUS_CHANGED_EVENT = 'join-request:status-changed' as const;

export type SocketMessagePayload = {
  id: string;
  joinRequestId: string;
  senderId: string;
  content: string;
  createdAt: string;
};

export type SocketTypingPayload = {
  joinRequestId: string;
  userId: string;
  displayName: string;
};

export type JoinRequestStatusChangedPayload = {
  joinRequestId: string;
  userId: string;
  status: string;
  eventId: string;
};
