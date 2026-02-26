import { NextResponse } from 'next/server';
import { requireAuth } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';

export const GET = requireAuth(async (request, context, auth) => {
  const userId = auth.userId;

  try {
    const joinRequests = await prisma.joinRequest.findMany({
      where: {
        OR: [
          { userId: userId },                      // User is guest
          { event: { hostId: userId } }            // User is host
        ]
      },
      include: {
        event: {
          select: {
            id: true,
            title: true,
            datetime: true,
            locationName: true,
            host: {
              select: {
                id: true,
                displayName: true,
                photoUrl: true,
                email: true
              }
            }
          }
        },
        user: {
          select: {
            id: true,
            displayName: true,
            photoUrl: true,
            email: true
          }
        },
        messages: {
          orderBy: { createdAt: 'desc' as const },
          take: 1,
          select: {
            id: true,
            content: true,
            createdAt: true,
            senderId: true
          }
        }
      },
      orderBy: { updatedAt: 'desc' as const }
    });

    // Calculate unread counts separately
    const unreadCounts = await Promise.all(
      joinRequests.map(async (jr) => {
        const count = await prisma.message.count({
          where: {
            joinRequestId: jr.id,
            senderId: { not: userId },
            readBy: {
              none: {
                userId: userId
              }
            }
          }
        });
        return { joinRequestId: jr.id, count };
      })
    );

    const unreadMap = new Map(unreadCounts.map(u => [u.joinRequestId, u.count]));

    // Transform to ConversationPreview format
    const conversations = joinRequests.map(jr => {
      const isUserGuest = jr.userId === userId;
      const otherUser = isUserGuest ? jr.event.host : jr.user;
      const lastMessage = jr.messages[0];

      // Format time label
      const timestamp = lastMessage?.createdAt || jr.createdAt;
      const now = Date.now();
      const diff = now - timestamp.getTime();
      const minutes = Math.floor(diff / 60000);
      const hours = Math.floor(diff / 3600000);
      const days = Math.floor(diff / 86400000);

      let updatedAtLabel: string;
      if (minutes < 1) updatedAtLabel = 'Just now';
      else if (minutes < 60) updatedAtLabel = `${minutes} min ago`;
      else if (hours < 24) updatedAtLabel = `${hours} hour${hours > 1 ? 's' : ''} ago`;
      else updatedAtLabel = `${days} day${days > 1 ? 's' : ''} ago`;

      return {
        id: jr.id,
        status: jr.status.toLowerCase() as "pending" | "accepted",
        participantName: otherUser.displayName || otherUser.email.split('@')[0],
        eventTitle: jr.event.title,
        locationName: jr.event.locationName ?? undefined,
        eventCategoryLabel: "Social", // TODO: Add category to Event model if needed
        messageSnippet: lastMessage?.content || (jr.status === 'PENDING' ? 'Waiting for host response...' : 'No messages yet'),
        updatedAtLabel,
        unreadCount: unreadMap.get(jr.id) || 0
      };
    });

    return NextResponse.json({ conversations });
  } catch (error) {
    console.error('Error fetching conversations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch conversations' },
      { status: 500 }
    );
  }
});
