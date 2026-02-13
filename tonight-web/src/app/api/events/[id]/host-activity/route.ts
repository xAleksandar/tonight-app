import { NextResponse } from "next/server";

import { JoinRequestStatus } from "@/generated/prisma/client";
import { createMessageForJoinRequest, CHAT_MESSAGE_MAX_LENGTH, ChatMessageValidationError } from "@/lib/chat";
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

export async function PATCH(request: Request, { params }: { params: { id?: string } }) {
  const auth = await getCurrentUser();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const eventId = params?.id?.trim();
  if (!eventId) {
    return NextResponse.json({ error: "Missing event id" }, { status: 400 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const body = (payload ?? {}) as { lastSeenAt?: unknown };
  const rawTimestamp = typeof body.lastSeenAt === "string" ? body.lastSeenAt : undefined;
  const timestamp = rawTimestamp ? new Date(rawTimestamp) : new Date();
  if (Number.isNaN(timestamp.getTime())) {
    return NextResponse.json({ error: "Invalid timestamp" }, { status: 400 });
  }

  const joinRequest = await prisma.joinRequest.findFirst({
    where: {
      eventId,
      userId: auth.userId,
      status: JoinRequestStatus.ACCEPTED,
    },
    select: { id: true },
  });

  if (!joinRequest) {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }

  const updated = await prisma.joinRequest.update({
    where: { id: joinRequest.id },
    data: { lastSeenHostActivityAt: timestamp },
    select: { lastSeenHostActivityAt: true },
  });

  return NextResponse.json({
    lastSeenAt: updated.lastSeenHostActivityAt?.toISOString() ?? null,
  });
}

export async function POST(request: Request, { params }: { params: { id?: string } }) {
  const auth = await getCurrentUser();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const eventId = params?.id?.trim();
  if (!eventId) {
    return NextResponse.json({ error: "Missing event id" }, { status: 400 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const body = (payload ?? {}) as { message?: unknown };
  const rawMessage = typeof body.message === "string" ? body.message : "";
  const message = rawMessage.trim();
  if (!message) {
    return NextResponse.json({ error: "Announcement message is required" }, { status: 400 });
  }

  if (message.length > CHAT_MESSAGE_MAX_LENGTH) {
    return NextResponse.json({ error: `Announcement must be under ${CHAT_MESSAGE_MAX_LENGTH} characters` }, { status: 400 });
  }

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { hostId: true },
  });

  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  if (event.hostId !== auth.userId) {
    return NextResponse.json({ error: "Only the host can publish announcements" }, { status: 403 });
  }

  const acceptedJoinRequests = await prisma.joinRequest.findMany({
    where: {
      eventId,
      status: JoinRequestStatus.ACCEPTED,
    },
    select: { id: true },
  });

  if (acceptedJoinRequests.length === 0) {
    return NextResponse.json({ error: "No accepted guests to notify yet" }, { status: 400 });
  }

  try {
    for (const joinRequest of acceptedJoinRequests) {
      await createMessageForJoinRequest(
        {
          joinRequestId: joinRequest.id,
          userId: auth.userId,
          content: message,
        },
        { skipRateLimit: true }
      );
    }
  } catch (error) {
    const fallback = "Unable to publish announcement";
    const status = error instanceof ChatMessageValidationError ? 400 : 500;
    const messagePayload = error instanceof ChatMessageValidationError ? error.message : fallback;
    console.error("Failed to publish host announcement", error);
    return NextResponse.json({ error: messagePayload }, { status });
  }

  return NextResponse.json({ delivered: acceptedJoinRequests.length }, { status: 201 });
}
