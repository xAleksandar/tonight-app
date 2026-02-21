import type { EventChatAttentionPayload } from "@/components/tonight/event-inside/EventInsideExperience";

export const buildChatAttentionLinkLabel = (entry?: EventChatAttentionPayload | null): string => {
  const name = entry?.authorName?.trim();
  if (name) {
    return `Open chat with ${name}`;
  }
  const helper = entry?.helperText?.trim();
  if (helper) {
    return helper;
  }
  const snippet = entry?.snippet?.trim();
  if (snippet) {
    return snippet.length > 60 ? `${snippet.slice(0, 57)}…` : snippet;
  }
  return "Open chat thread";
};

export const formatRelativeTime = (value?: string | null): string => {
  if (!value) return "moments ago";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "moments ago";
  const deltaMs = date.getTime() - Date.now();
  const deltaMinutes = Math.round(deltaMs / (1000 * 60));
  if (Math.abs(deltaMinutes) < 1) {
    return "just now";
  }
  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  if (Math.abs(deltaMinutes) < 60) {
    return formatter.format(Math.round(deltaMinutes), "minute");
  }
  const deltaHours = Math.round(deltaMinutes / 60);
  if (Math.abs(deltaHours) < 24) {
    return formatter.format(deltaHours, "hour");
  }
  const deltaDays = Math.round(deltaHours / 24);
  return formatter.format(deltaDays, "day");
};
