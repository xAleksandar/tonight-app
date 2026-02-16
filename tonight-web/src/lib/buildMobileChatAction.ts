import type { EventInsideExperienceProps } from "@/components/tonight/event-inside/EventInsideExperience";
import type { MobileActionBarProps } from "@/components/tonight/MobileActionBar";

type BuildMobileChatActionOptions = {
  attentionActive?: boolean;
  attentionLabel?: string | null;
  onInteract?: () => void;
};

export const buildMobileChatAction = (
  viewerRole: EventInsideExperienceProps["viewerRole"],
  chatPreview?: EventInsideExperienceProps["chatPreview"],
  options: BuildMobileChatActionOptions = {}
): MobileActionBarProps["chatAction"] => {
  if (!chatPreview?.ctaHref) {
    return null;
  }

  const label = chatPreview.ctaLabel && chatPreview.ctaLabel.trim().length > 0 ? chatPreview.ctaLabel.trim() : "Open chat";
  const summary =
    chatPreview.lastMessageSnippet ??
    (viewerRole === "host"
      ? "Guest pings will show up here once someone reaches out."
      : viewerRole === "guest"
        ? "Host updates will surface here once the thread gets activity."
        : viewerRole === "pending"
          ? "Chat unlocks right after the host approves you."
          : "Request access to unlock this chat.");

  type ChatActionConfig = NonNullable<MobileActionBarProps["chatAction"]>;
  let badgeTone: NonNullable<ChatActionConfig["badgeTone"]> = "muted";
  let badgeLabel: string | null = null;

  if (typeof chatPreview.unreadCount === "number" && chatPreview.unreadCount > 0) {
    badgeLabel = `${chatPreview.unreadCount} unread`;
    badgeTone = "highlight";
  } else if (viewerRole === "host" || viewerRole === "guest") {
    badgeLabel = "You're caught up";
    badgeTone = "success";
  } else if (viewerRole === "pending") {
    badgeLabel = "Approval required";
  } else {
    badgeLabel = "Login required";
  }

  return {
    href: chatPreview.ctaHref,
    label,
    helperText: summary,
    badgeLabel,
    badgeTone,
    attentionActive: Boolean(options.attentionActive),
    attentionLabel: options.attentionActive ? options.attentionLabel ?? "New chat ping" : null,
    onInteract: options.onInteract,
  };
};
