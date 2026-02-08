import { notFound, redirect } from 'next/navigation';

import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/middleware/auth';
import { getChatAccessContext } from '@/lib/chat';
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

const buildChatContext = async (joinRequestId: string, userId: string): Promise<ChatConversationContext | null> => {
  try {
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
      return null;
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
    console.error('Failed to load chat context', error);
    return null;
  }
};

interface PageProps {
  params?: {
    joinRequestId?: string | string[];
  };
}

export default async function ChatPage({ params }: PageProps) {
  const joinRequestId = normalizeParam(params?.joinRequestId);
  if (!joinRequestId) {
    notFound();
  }

  const auth = await getCurrentUser();
  if (!auth) {
    const searchParams = new URLSearchParams({ next: `/chat/${joinRequestId}` });
    redirect(`/login?${searchParams.toString()}`);
  }

  const authenticatedUser = auth as NonNullable<typeof auth>;

  const context = await buildChatContext(joinRequestId, authenticatedUser.userId);
  if (!context) {
    notFound();
  }

  return (
    <ChatConversation
      joinRequestId={joinRequestId}
      currentUserId={authenticatedUser.userId}
      socketToken={authenticatedUser.token}
      context={context}
    />
  );
}
