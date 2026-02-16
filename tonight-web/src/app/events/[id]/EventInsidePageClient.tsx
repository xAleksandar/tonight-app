"use client";

import { useCallback, useState } from "react";
import type { MobileActionBarProps } from "@/components/tonight/MobileActionBar";
import { EventLayout } from "./EventLayout";
import type { EventInsideExperienceProps } from "@/components/tonight/event-inside/EventInsideExperience";
import { EventInsideExperience } from "@/components/tonight/event-inside/EventInsideExperience";
import { buildMobileChatAction } from "@/lib/buildMobileChatAction";

type EventInsidePageClientProps = {
  experience: EventInsideExperienceProps;
  layoutProps: {
    eventTitle: string;
    eventLocation: string;
    userDisplayName: string | null;
    userEmail: string | null;
    userPhotoUrl: string | null;
  };
  initialChatAction: MobileActionBarProps["chatAction"];
};

export function EventInsidePageClient({ experience, layoutProps, initialChatAction }: EventInsidePageClientProps) {
  const [chatAction, setChatAction] = useState(initialChatAction);

  const handleChatPreviewRefresh = useCallback(
    (nextPreview: EventInsideExperienceProps["chatPreview"] | undefined) => {
      const nextAction = buildMobileChatAction(experience.viewerRole, nextPreview ?? experience.chatPreview);
      setChatAction(nextAction);
    },
    [experience.chatPreview, experience.viewerRole]
  );

  return (
    <EventLayout
      eventTitle={layoutProps.eventTitle}
      eventLocation={layoutProps.eventLocation}
      userDisplayName={layoutProps.userDisplayName}
      userEmail={layoutProps.userEmail}
      userPhotoUrl={layoutProps.userPhotoUrl}
      chatAction={chatAction}
    >
      <EventInsideExperience {...experience} onChatPreviewRefresh={handleChatPreviewRefresh} />
    </EventLayout>
  );
}
