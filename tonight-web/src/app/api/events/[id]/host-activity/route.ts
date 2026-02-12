import { NextResponse } from "next/server";

import { JoinRequestStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/middleware/auth";

const HOST_ACTIVITY_PAGE_SIZE = 3;

export async function GET(request: Request, { params }: { params: { id?: string } }) {
  const auth = await getCurrentUser();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const eventId = params?.id?.trim();
  if (!eventId) {
    return NextResponse.json({ error: "Missing event id" }, { status: 400 });
  }

  const viewerId = auth.userId;

  const joinRequest = await prisma.joinRequest.findFirst({
    where: {
      eventId,
      userId: viewerId,
      status: JoinRequestStatus.ACCEPTED,
    },
    select: {
      id: true,
      event: {
        select: {
          hostId: true,
          hostDisplayName: true,
          hostEmail: true,
        },
      },
    },
  });

  if (!joinRequest || !joinRequest.event) {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }

  const searchParams = new URL(request.url).searchParams;
  const beforeParam = searchParams.get("before");
  const beforeDate = beforeParam ? new Date(beforeParam) : undefined;
  const createdAtFilter = beforeDate && !Number.isNaN(beforeDate.getTime()) ? { lt: beforeDate } : undefined;

  const messages = await prisma.message.findMany({
    where: {
      joinRequestId: joinRequest.id,
      senderId: joinRequest.event.hostId,
      ...(createdAtFilter ? { createdAt: createdAtFilter } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: HOST_ACTIVITY_PAGE_SIZE + 1,
    select: {
      id: true,
      content: true,
      createdAt: true,
    },
  });

  const hasMore = messages.length > HOST_ACTIVITY_PAGE_SIZE;
  const cursorSource = hasMore ? messages[HOST_ACTIVITY_PAGE_SIZE] : undefined;
  const trimmedMessages = hasMore ? messages.slice(0, HOST_ACTIVITY_PAGE_SIZE) : messages;

  const updates = trimmedMessages.map((message) => ({
    id: message.id,
    message: message.content,
    postedAtISO: message.createdAt?.toISOString() ?? null,
    authorName: joinRequest.event?.hostDisplayName ?? joinRequest.event?.hostEmail ?? "Host",
  }));

  return NextResponse.json({
    updates,
    hasMore,
    nextCursor: hasMore && cursorSource?.createdAt ? cursorSource.createdAt.toISOString() : null,
  });
}
