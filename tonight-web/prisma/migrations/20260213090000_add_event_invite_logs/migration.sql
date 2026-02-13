-- CreateTable
CREATE TABLE "EventInviteLog" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "inviterId" TEXT NOT NULL,
    "inviteeId" TEXT NOT NULL,
    "sourceJoinRequestId" TEXT,
    "invitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventInviteLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EventInviteLog_eventId_inviteeId_key" ON "EventInviteLog"("eventId", "inviteeId");
CREATE INDEX "EventInviteLog_inviterId_idx" ON "EventInviteLog"("inviterId");
CREATE INDEX "EventInviteLog_inviteeId_idx" ON "EventInviteLog"("inviteeId");

-- AddForeignKey
ALTER TABLE "EventInviteLog"
  ADD CONSTRAINT "EventInviteLog_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EventInviteLog"
  ADD CONSTRAINT "EventInviteLog_inviterId_fkey" FOREIGN KEY ("inviterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EventInviteLog"
  ADD CONSTRAINT "EventInviteLog_inviteeId_fkey" FOREIGN KEY ("inviteeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EventInviteLog"
  ADD CONSTRAINT "EventInviteLog_sourceJoinRequestId_fkey" FOREIGN KEY ("sourceJoinRequestId") REFERENCES "JoinRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
