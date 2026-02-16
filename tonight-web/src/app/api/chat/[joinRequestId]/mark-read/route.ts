import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { getChatAccessContext } from '@/lib/chat';
import { socketService } from '@/lib/socket';

export const POST = requireAuth(async (request, context, auth): Promise<NextResponse> => {
  const { joinRequestId } = (context as { params: { joinRequestId: string } }).params;
  const userId = auth.userId;

  try {
    // Verify user has access to this conversation
    await getChatAccessContext({ joinRequestId, userId });

    // Find all messages in this conversation sent by OTHER user
    const messages = await prisma.message.findMany({
      where: {
        joinRequestId,
        senderId: { not: userId }, // Only messages from other user
      },
      select: {
        id: true,
      },
    });

    // Check which messages are already marked as read
    const existingReads = await prisma.messageRead.findMany({
      where: {
        userId,
        messageId: { in: messages.map(m => m.id) },
      },
      select: {
        messageId: true,
      },
    });

    const existingReadIds = new Set(existingReads.map(r => r.messageId));
    const unreadMessages = messages.filter(m => !existingReadIds.has(m.id));

    // Create MessageRead records for unread messages
    let markedCount = 0;
    if (unreadMessages.length > 0) {
      await prisma.messageRead.createMany({
        data: unreadMessages.map(message => ({
          userId,
          messageId: message.id,
        })),
        skipDuplicates: true,
      });
      markedCount = unreadMessages.length;

      const readAt = new Date().toISOString();
      try {
        socketService.emitReadReceipt({
          joinRequestId,
          readerId: userId,
          receipts: unreadMessages.map((message) => ({
            messageId: message.id,
            readAt,
          })),
        });
      } catch (emitError) {
        console.error('Failed to emit read receipt event', emitError);
      }
    }

    return NextResponse.json({
      success: true,
      markedAsRead: markedCount,
    });
  } catch (error) {
    console.error('Error marking messages as read:', error);
    return NextResponse.json(
      { error: 'Failed to mark messages as read' },
      { status: 500 }
    );
  }
});
