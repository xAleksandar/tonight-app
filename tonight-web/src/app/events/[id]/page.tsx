import { EventInsideExperience, type EventInsideExperienceProps } from "@/components/tonight/event-inside/EventInsideExperience";

const mockAttendees: EventInsideExperienceProps["attendees"] = [
  { id: "1", displayName: "Rado", status: "confirmed", blurb: "Bringing two friends" },
  { id: "2", displayName: "Lina", status: "confirmed", blurb: "DJing after 11" },
  { id: "3", displayName: "Moni", status: "pending", blurb: "Running late" },
  { id: "4", displayName: "Stefan", status: "waitlist" },
];

const mockRequests: EventInsideExperienceProps["joinRequests"] = [
  {
    id: "jr-1",
    displayName: "Ivana",
    intro: "Love rooftop chess nights—can bring dessert",
    submittedAtISO: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
    mutualFriends: 2,
  },
  {
    id: "jr-2",
    displayName: "Marco",
    intro: "Product designer, visiting from Lisbon",
    submittedAtISO: new Date(Date.now() - 1000 * 60 * 50).toISOString(),
  },
];

const mockChat: EventInsideExperienceProps["chatPreview"] = {
  lastMessageSnippet: "Need anything else before doors open?",
  lastMessageAtISO: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
  unreadCount: 3,
  participantCount: 8,
};

export default function EventInsidePage({ params }: { params: { id: string } }) {
  const experience: EventInsideExperienceProps = {
    event: {
      id: params.id,
      title: "Rooftop chess club + midnight cafe crawl",
      description: "Small group hang to play speed chess, trade favorite cafes, and plan the after hours run.",
      startDateISO: new Date(Date.now() + 1000 * 60 * 60 * 5).toISOString(),
      locationName: "Secret rooftop near NDK",
      vibeTags: ["soft launch", "invite-only", "night owls"],
      entryNotes: ["Send your favorite chess opening", "Bring a layer (windy)", "Keep exact address private"],
      capacityLabel: "12 spots",
    },
    host: {
      id: "host-1",
      displayName: "Aleks",
      bio: "Curates late-night meetups across Sofia",
      email: "aleks@tonight.so",
    },
    attendees: mockAttendees,
    joinRequests: mockRequests,
    chatPreview: mockChat,
    viewerRole: "host",
  };

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10 sm:px-6 lg:px-0">
      <EventInsideExperience {...experience} />
      <p className="text-center text-xs text-white/60">
        Placeholder data until the real event membership APIs land.
      </p>
    </div>
  );
}
