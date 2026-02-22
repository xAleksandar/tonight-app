type EventShareDetails = {
  title: string;
  startDateISO?: string | null;
  locationName?: string | null;
};

const DEFAULT_SHARE_ORIGIN = "https://tonight.app";

const resolveShareOrigin = () => {
  const envOrigin = process.env.NEXT_PUBLIC_APP_URL;
  if (!envOrigin) {
    return DEFAULT_SHARE_ORIGIN;
  }
  return envOrigin.endsWith("/") ? envOrigin.slice(0, -1) : envOrigin;
};

export const buildEventShareUrl = (eventId: string) => `${resolveShareOrigin()}/events/${eventId}`;

export const buildEventInviteShareText = ({ title, startDateISO, locationName }: EventShareDetails) => {
  const parts: string[] = [`Join me at "${title}"`];
  const when = formatEventShareMoment(startDateISO);
  if (when) {
    parts.push(`on ${when}`);
  }
  const locationLabel = locationName?.trim();
  if (locationLabel) {
    parts.push(`near ${locationLabel}`);
  }
  parts.push("Request access on Tonight.");
  return parts.join(" ");
};

export const formatEventShareMoment = (value?: string | null) => {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
};
