import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/middleware/auth";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await getCurrentUser();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: rawEventId } = await context.params;
  const eventId = rawEventId?.trim();
  if (!eventId) {
    return NextResponse.json({ error: "Missing event id" }, { status: 400 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const body = (payload ?? {}) as { userId?: unknown; sourceJoinRequestId?: unknown };
  const rawUserId = typeof body.userId === "string" ? body.userId.trim() : "";
  if (!rawUserId) {
    return NextResponse.json({ error: "Target user id is required" }, { status: 400 });
  }

  const sourceJoinRequestId =
    typeof body.sourceJoinRequestId === "string" && body.sourceJoinRequestId.trim().length
      ? body.sourceJoinRequestId.trim()
      : undefined;

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { hostId: true },
  });

  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  if (event.hostId !== auth.userId) {
    return NextResponse.json({ error: "Only the host can log invites for this event" }, { status: 403 });
  }

  const invitee = await prisma.user.findUnique({
    where: { id: rawUserId },
    select: { id: true },
  });

  if (!invitee) {
    return NextResponse.json({ error: "Target user not found" }, { status: 404 });
  }

  const record = await prisma.eventInviteLog.upsert({
    where: {
      eventId_inviteeId: {
        eventId,
        inviteeId: rawUserId,
      },
    },
    update: {
      invitedAt: new Date(),
      sourceJoinRequestId: sourceJoinRequestId ?? undefined,
    },
    create: {
      eventId,
      inviterId: auth.userId,
      inviteeId: rawUserId,
      sourceJoinRequestId: sourceJoinRequestId ?? undefined,
    },
    select: {
      invitedAt: true,
    },
  });

  return NextResponse.json({ invitedAtISO: record.invitedAt?.toISOString() ?? null }, { status: 201 });
}
