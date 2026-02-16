import { notFound, redirect } from 'next/navigation';

import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/middleware/auth';
import {
  getChatAccessContext,
  ChatBlockedError,
  ChatUnauthorizedError,
  ChatJoinRequestNotAcceptedError,
  ChatJoinRequestNotFoundError,
} from '@/lib/chat';
import ChatConversation, {
  type ChatConversationContext,
  type ChatParticipantSummary,
} from '@/components/chat/ChatConversation';

const mapParticipant = (record: {
  id: string;
  displayName: string | null;
  email: string;
  photoUrl: string | null;
}): ChatParticipantSummary => ({
  id: record.id,
  displayName: record.displayName,
  email: record.email,
  photoUrl: record.photoUrl,
});

const normalizeParam = (value: string | string[] | undefined) => {
  if (typeof value === 'string') {
    return value.trim();
  }
  if (Array.isArray(value)) {
    return value[0]?.trim() ?? '';
  }
  return '';
};

const buildChatContext = async (joinRequestId: string, userId: string): Promise<ChatConversationContext> => {
  try {
    // Consolidate queries: Get access context and join request data in parallel
    const accessContext = await getChatAccessContext({ joinRequestId, userId });

    const record = await prisma.joinRequest.findUnique({
      where: { id: joinRequestId },
      select: {
        id: true,
        user: {
          select: {
            id: true,
            displayName: true,
            email: true,
            photoUrl: true,
          },
        },
        event: {
          select: {
            id: true,
            title: true,
            locationName: true,
            datetime: true,
            host: {
              select: {
                id: true,
                displayName: true,
                email: true,
                photoUrl: true,
              },
            },
          },
        },
      },
    });

    if (!record || !record.event.host) {
      throw new ChatJoinRequestNotFoundError('Join request or host not found');
    }

    return {
      requesterRole: accessContext.requesterRole,
      host: mapParticipant(record.event.host),
      participant: mapParticipant(record.user),
      event: {
        id: record.event.id,
        title: record.event.title,
        locationName: record.event.locationName,
        datetime: record.event.datetime.toISOString(),
      },
    } satisfies ChatConversationContext;
  } catch (error) {
    // Re-throw specific chat errors to be caught by error boundary
    if (
      error instanceof ChatBlockedError ||
      error instanceof ChatUnauthorizedError ||
      error instanceof ChatJoinRequestNotAcceptedError ||
      error instanceof ChatJoinRequestNotFoundError
    ) {
      throw error;
    }

    // Log unexpected errors and re-throw
    console.error('Failed to load chat context', error);
    throw error;
  }
};

interface PageProps {
  params: Promise<{
    joinRequestId: string;
  }>;
}

export default async function ChatPage({ params }: PageProps) {
  const resolvedParams = await params;
  const joinRequestId = normalizeParam(resolvedParams?.joinRequestId);
  if (!joinRequestId) {
    notFound();
  }

  const auth = await getCurrentUser();
  if (!auth) {
    const searchParams = new URLSearchParams({ next: `/chat/${joinRequestId}` });
    redirect(`/login?${searchParams.toString()}`);
  }

  const authenticatedUser = auth as NonNullable<typeof auth>;

  // buildChatContext will throw specific errors if access is denied
  // These errors are caught by error.tsx for user-friendly display
  const context = await buildChatContext(joinRequestId, authenticatedUser.userId);

  return (
    <ChatConversation
      joinRequestId={joinRequestId}
      currentUserId={authenticatedUser.userId}
      socketToken={authenticatedUser.token}
      context={context}
    />
  );
}
