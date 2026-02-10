"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import * as SliderPrimitive from "@radix-ui/react-slider";
import type { LucideIcon } from "lucide-react";
import {
  ChevronRight,
  Clapperboard,
  Coffee,
  Dumbbell,
  MapPin,
  MessageCircle,
  Music,
  SlidersHorizontal,
  Sparkles,
  Users as UsersIcon,
  UtensilsCrossed,
  Waves,
} from "lucide-react";

import { AuthStatusMessage } from "@/components/auth/AuthStatusMessage";
import type { AuthUser } from "@/components/auth/AuthProvider";
import { MessagesModal } from "@/components/chat/MessagesModal";
import { PLACEHOLDER_CONVERSATIONS } from "@/components/chat/conversations";
import { DesktopHeader } from "@/components/tonight/DesktopHeader";
import { DesktopSidebar } from "@/components/tonight/DesktopSidebar";
import { MiniMap } from "@/components/tonight/MiniMap";
import { MobileActionBar } from "@/components/tonight/MobileActionBar";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { CATEGORY_DEFINITIONS, CATEGORY_ORDER, type CategoryId } from "@/lib/categories";
import { classNames } from "@/lib/classNames";

const MIN_RANGE_KM = 1;
const MAX_RANGE_KM = 50;
const DEFAULT_RANGE_KM = 10;
const PEOPLE_MAP_LATITUDE = 42.6977;
const PEOPLE_MAP_LONGITUDE = 23.3219;
const PEOPLE_MAP_LOCATION_LABEL = "Downtown radius preview";

type PrimarySection = "discover" | "people" | "messages";

type PersonEventCategory = CategoryId;

type PersonEvent = {
  title: string;
  category: PersonEventCategory;
  timeLabel: string;
  statusLabel: string;
};

type PersonProspect = {
  id: string;
  name: string;
  initials: string;
  distanceKm: number;
  bio: string;
  events: PersonEvent[];
};

const CATEGORY_ICON_MAP: Record<PersonEventCategory, LucideIcon> = {
  cinema: Clapperboard,
  food: UtensilsCrossed,
  outdoor: Waves,
  music: Music,
  fitness: Dumbbell,
  social: Coffee,
};

const CATEGORY_STYLE_MAP: Record<PersonEventCategory, string> = {
  cinema: "border-sky-400/30 bg-sky-500/10 text-sky-200",
  food: "border-amber-400/30 bg-amber-500/10 text-amber-200",
  outdoor: "border-emerald-400/30 bg-emerald-500/10 text-emerald-200",
  music: "border-rose-400/30 bg-rose-500/10 text-rose-200",
  fitness: "border-lime-400/30 bg-lime-500/10 text-lime-200",
  social: "border-orange-400/30 bg-orange-500/10 text-orange-200",
};

const PEOPLE_PROSPECTS: PersonProspect[] = [
  {
    id: "alice",
    name: "Alice W.",
    initials: "AW",
    distanceKm: 0.5,
    bio: "Beach lover plotting a sunset walk. Down to coordinate rides or snacks for tomorrow's coastal meetup.",
    events: [
      {
        title: "Going to Sea",
        category: "outdoor",
        timeLabel: "Tonight · 8:45 PM",
        statusLabel: "Need 2 seats",
      },
    ],
  },
  {
    id: "marco",
    name: "Marco R.",
    initials: "MR",
    distanceKm: 1.2,
    bio: "Movie enthusiast with a standing Friday pass. Happy to swap trailers and pick the perfect row.",
    events: [
      {
        title: "Late cinema run",
        category: "cinema",
        timeLabel: "Tomorrow · 10:15 PM",
        statusLabel: "2 invites",
      },
    ],
  },
  {
    id: "sofia",
    name: "Sofia M.",
    initials: "SM",
    distanceKm: 3.1,
    bio: "Jazz fan + espresso evangelist. Looking for company for a mellow set downtown.",
    events: [
      {
        title: "Live jazz night",
        category: "music",
        timeLabel: "Tonight · 9:30 PM",
        statusLabel: "1 spot",
      },
    ],
  },
  {
    id: "elena",
    name: "Elena K.",
    initials: "EK",
    distanceKm: 2.8,
    bio: "Restaurant-hopping this week. Always game to discover a new chef's menu.",
    events: [
      {
        title: "Sushi tasting",
        category: "food",
        timeLabel: "Tomorrow · 7:00 PM",
        statusLabel: "Host pick",
      },
    ],
  },
  {
    id: "dan",
    name: "Dan P.",
    initials: "DP",
    distanceKm: 0.8,
    bio: "Trainer by day, pickleball fan by night. Need a push partner?",
    events: [
      {
        title: "Evening gym drop-in",
        category: "fitness",
        timeLabel: "Today · 6:30 PM",
        statusLabel: "Co-op",
      },
    ],
  },
  {
    id: "ana",
    name: "Ana B.",
    initials: "AB",
    distanceKm: 1.9,
    bio: "Board game collector. Hosting casual sessions with good coffee and playlists.",
    events: [
      {
        title: "Coffee & boards",
        category: "social",
        timeLabel: "Sunday · 4:00 PM",
        statusLabel: "Open",
      },
    ],
  },
];

export default function PeoplePage() {
  const { status: authStatus, user: authUser } = useRequireAuth();

  if (authStatus === "loading") {
    return <AuthStatusMessage label="Checking your session…" />;
  }

  if (authStatus === "unauthenticated") {
    return <AuthStatusMessage label="Redirecting you to the welcome screen…" />;
  }

  if (authStatus === "error") {
    return <AuthStatusMessage label="We couldn't verify your session. Refresh to try again." />;
  }

  return <AuthenticatedPeoplePage currentUser={authUser ?? null} />;
}

function AuthenticatedPeoplePage({ currentUser }: { currentUser: AuthUser | null }) {
  const router = useRouter();
  const [selectedCategory, setSelectedCategory] = useState<CategoryId | null>(null);
  const [rangeKm, setRangeKm] = useState(DEFAULT_RANGE_KM);
  const [rangeSheetOpen, setRangeSheetOpen] = useState(false);
  const [rangeSheetValue, setRangeSheetValue] = useState(rangeKm);
  const [activePrimarySection, setActivePrimarySection] = useState<PrimarySection>("people");
  const [messagesModalOpen, setMessagesModalOpen] = useState(false);

  const handleCreate = useCallback(() => router.push("/events/create"), [router]);
  const handleCloseMessages = useCallback(() => {
    setMessagesModalOpen(false);
    setActivePrimarySection("people");
  }, []);
  const handleToggleMessages = useCallback(() => {
    setMessagesModalOpen((current) => {
      const next = !current;
      setActivePrimarySection(next ? "messages" : "people");
      return next;
    });
  }, []);
  const handleDiscover = useCallback(() => {
    setMessagesModalOpen(false);
    setActivePrimarySection("discover");
    router.push("/");
  }, [router]);
  const handlePeopleNav = useCallback(() => {
    setMessagesModalOpen(false);
    setActivePrimarySection("people");
    router.push("/people");
  }, [router]);

  const visibleProspects = useMemo(() => {
    return PEOPLE_PROSPECTS.filter((person) => {
      const withinRange = person.distanceKm <= rangeKm + 0.001;
      if (!withinRange) {
        return false;
      }
      if (!selectedCategory) {
        return true;
      }
      return person.events.some((event) => event.category === selectedCategory);
    });
  }, [rangeKm, selectedCategory]);

  const filtersActive = selectedCategory !== null || rangeKm !== DEFAULT_RANGE_KM;

  const handleResetFilters = useCallback(() => {
    setRangeKm(DEFAULT_RANGE_KM);
    setSelectedCategory(null);
  }, []);

  const conversations = useMemo(() => PLACEHOLDER_CONVERSATIONS, []);
  const unreadMessageCount = useMemo(
    () => conversations.reduce((total, conversation) => total + (conversation.unreadCount ?? 0), 0),
    [conversations]
  );
  const handleSelectConversation = useCallback(
    (conversationId: string) => {
      if (conversationId.startsWith("demo-")) {
        return;
      }
      setActivePrimarySection("people");
      setMessagesModalOpen(false);
      router.push(`/chat/${conversationId}`);
    },
    [router]
  );
  const messagesEmptyStateAction = useMemo(
    () => ({ label: "Browse Discover", onAction: handleDiscover }),
    [handleDiscover]
  );

  return (
    <div className="min-h-dvh bg-gradient-to-b from-[#070b1c] via-[#060814] to-[#05060f] text-foreground">
      <div className="flex min-h-dvh flex-col md:flex-row">
        <DesktopSidebar
          selectedCategory={selectedCategory}
          onCategoryChange={setSelectedCategory}
          onCreate={handleCreate}
          onNavigateDiscover={handleDiscover}
          onNavigatePeople={handlePeopleNav}
          onNavigateMessages={handleToggleMessages}
          activePrimaryNav={activePrimarySection}
        />

        <div className="flex flex-1 flex-col">
          <DesktopHeader
            title="People nearby"
            subtitle="See who's open to meeting up tonight"
            onNavigateProfile={() => router.push("/profile")}
            onNavigateMessages={handleToggleMessages}
            unreadCount={unreadMessageCount}
            userDisplayName={currentUser?.displayName ?? null}
            userEmail={currentUser?.email ?? null}
            userPhotoUrl={currentUser?.photoUrl ?? null}
          />

          <main className="flex-1 px-4 pb-28 pt-4 md:px-10 md:pb-12 md:pt-8">
            <div className="mx-auto w-full max-w-6xl space-y-6">
              <PeopleMobileHeader
                rangeKm={rangeKm}
                onOpenFilters={() => {
                  setRangeSheetValue(rangeKm);
                  setRangeSheetOpen(true);
                }}
                selectedCategory={selectedCategory}
                onCategoryChange={setSelectedCategory}
              />

              <PeopleExplainerPanel />

              <PeopleRangeControls
                className="hidden md:block"
                value={rangeKm}
                onChange={setRangeKm}
              />

              {visibleProspects.length > 0 ? (
                <PeopleGrid
                  prospects={visibleProspects}
                  onContact={handleToggleMessages}
                  onViewPlans={handleDiscover}
                />
              ) : (
                <PeopleEmptyState filtersActive={filtersActive} onResetFilters={handleResetFilters} />
              )}
            </div>
          </main>
        </div>
      </div>

      <MobileActionBar
        active={activePrimarySection === "messages" ? "messages" : activePrimarySection}
        onNavigateDiscover={handleDiscover}
        onNavigatePeople={handlePeopleNav}
        onNavigateMessages={handleToggleMessages}
        onCreate={handleCreate}
        onOpenProfile={() => router.push("/profile")}
        messagesUnreadCount={unreadMessageCount}
      />

      {rangeSheetOpen ? (
        <PeopleRangeSheet
          value={rangeSheetValue}
          onChange={setRangeSheetValue}
          onApply={() => {
            setRangeKm(rangeSheetValue);
            setRangeSheetOpen(false);
          }}
          onClose={() => setRangeSheetOpen(false)}
        />
      ) : null}
    </div>
  );
}

type PeopleGridProps = {
  prospects: PersonProspect[];
  onContact: () => void;
  onViewPlans: () => void;
};

function PeopleGrid({ prospects, onContact, onViewPlans }: PeopleGridProps) {
  return (
    <section>
      <div className="mb-4 flex flex-col gap-1 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-primary/80">Tonight</p>
          <h2 className="font-serif text-2xl font-semibold">Who else is out?</h2>
          <p className="text-sm text-muted-foreground">People who recently marked themselves available within your radius.</p>
        </div>
        <p className="text-xs text-muted-foreground/80">Sorted by distance · auto-refreshes every few minutes</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {prospects.map((person) => (
          <PeopleCard key={person.id} person={person} onContact={onContact} onViewPlans={onViewPlans} />
        ))}
      </div>
    </section>
  );
}

type PeopleCardProps = {
  person: PersonProspect;
  onContact: () => void;
  onViewPlans: () => void;
};

function PeopleCard({ person, onContact, onViewPlans }: PeopleCardProps) {
  return (
    <article className="flex h-full flex-col gap-4 rounded-3xl border border-border/60 bg-card/60 p-5 shadow-xl shadow-black/20 transition hover:border-primary/40">
      <header className="flex items-center gap-3">
        <InitialsAvatar initials={person.initials} />
        <div className="flex flex-1 flex-col">
          <p className="text-sm font-semibold text-foreground">{person.name}</p>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="h-3.5 w-3.5" />
            {person.distanceKm.toFixed(1)} km from you
          </span>
        </div>
        <button
          type="button"
          onClick={onContact}
          className="inline-flex items-center gap-1.5 rounded-2xl border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary transition hover:bg-primary/15"
        >
          <MessageCircle className="h-3.5 w-3.5" />
          Contact
        </button>
      </header>

      <p className="text-sm text-muted-foreground leading-relaxed">{person.bio}</p>

      <div className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Their plans</p>
        {person.events.map((event) => {
          const Icon = CATEGORY_ICON_MAP[event.category];
          return (
            <button
              key={`${person.id}-${event.title}`}
              type="button"
              onClick={onViewPlans}
              className="group flex w-full items-center gap-3 rounded-2xl border border-border/60 bg-background/40 px-3 py-3 text-left transition hover:border-primary/40"
            >
              <span
                className={classNames(
                  "flex h-10 w-10 items-center justify-center rounded-xl border text-sm",
                  CATEGORY_STYLE_MAP[event.category],
                )}
              >
                <Icon className="h-4 w-4" />
              </span>
              <span className="flex-1">
                <span className="block text-sm font-semibold text-foreground">{event.title}</span>
                <span className="text-xs text-muted-foreground">{event.timeLabel}</span>
              </span>
              <span className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {event.statusLabel}
                <ChevronRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
              </span>
            </button>
          );
        })}
      </div>
    </article>
  );
}

type PeopleRangeControlsProps = {
  value: number;
  onChange: (value: number) => void;
  className?: string;
};

function PeopleRangeControls({ value, onChange, className }: PeopleRangeControlsProps) {
  return (
    <section className={classNames("rounded-3xl border border-border/60 bg-card/60 p-6 shadow-xl shadow-black/20", className)}>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-muted-foreground">People range</p>
              <h3 className="font-serif text-2xl font-semibold">{Math.round(value)} km radius</h3>
              <p className="text-sm text-muted-foreground">
                Tune how far away we should surface members who marked an active plan.
              </p>
            </div>
            <div className="hidden text-right text-xs text-muted-foreground sm:block">
              Auto-matches refresh when someone nearby updates their status.
            </div>
          </div>
          <div className="mt-6 space-y-3">
            <SliderPrimitive.Root
              className="relative flex h-8 w-full touch-none select-none items-center"
              max={MAX_RANGE_KM}
              min={MIN_RANGE_KM}
              step={1}
              value={[value]}
              aria-label="People radius"
              onValueChange={([next]) => {
                if (typeof next === "number") {
                  onChange(next);
                }
              }}
            >
              <SliderPrimitive.Track className="relative h-2 w-full grow overflow-hidden rounded-full bg-border/60">
                <SliderPrimitive.Range className="absolute h-full rounded-full bg-primary" />
              </SliderPrimitive.Track>
              <SliderPrimitive.Thumb className="block h-5 w-5 rounded-full border-[3px] border-background bg-primary-foreground shadow-[0_6px_18px_rgba(0,0,0,0.45)] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50" />
            </SliderPrimitive.Root>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{MIN_RANGE_KM} km</span>
              <span>{MAX_RANGE_KM} km</span>
            </div>
          </div>
        </div>

        <PeopleRangeMapPreview radiusKm={value} />
      </div>
    </section>
  );
}

function PeopleRangeMapPreview({ radiusKm }: { radiusKm: number }) {
  const roundedRadius = Math.round(radiusKm);
  return (
    <div className="rounded-3xl border border-white/10 bg-background/60 p-3">
      <MiniMap
        latitude={PEOPLE_MAP_LATITUDE}
        longitude={PEOPLE_MAP_LONGITUDE}
        locationName={PEOPLE_MAP_LOCATION_LABEL}
        height={220}
        className="rounded-2xl border border-white/5"
      />
      <div className="mt-3 space-y-1 text-xs text-muted-foreground">
        <p className="text-sm font-semibold text-foreground">Preview coverage</p>
        <p>
          Showing roughly a {roundedRadius} km catchment so coordinators can sense how wide tonight&apos;s net is. We&apos;ll
          swap this preview for your live location once permissions are wired in.
        </p>
      </div>
    </div>
  );
}

type PeopleMobileHeaderProps = {
  rangeKm: number;
  onOpenFilters: () => void;
  selectedCategory: CategoryId | null;
  onCategoryChange: (category: CategoryId | null) => void;
};

function PeopleMobileHeader({ rangeKm, onOpenFilters, selectedCategory, onCategoryChange }: PeopleMobileHeaderProps) {
  return (
    <div className="space-y-3 md:hidden">
      <div className="flex items-center justify-between rounded-3xl border border-border/60 bg-card/60 px-4 py-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">Tonight</p>
          <h1 className="text-2xl font-serif font-semibold leading-tight">People nearby</h1>
          <p className="text-xs text-muted-foreground">Discover who's free to make plans.</p>
        </div>
        <button
          type="button"
          onClick={onOpenFilters}
          className="inline-flex items-center gap-1.5 rounded-2xl border border-border/70 bg-background/40 px-3 py-2 text-xs font-semibold text-foreground"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          {Math.round(rangeKm)} km
        </button>
      </div>
      <div className="flex items-start gap-3 rounded-3xl border border-primary/20 bg-primary/5 px-4 py-4 text-xs text-muted-foreground">
        <div className="flex h-9 w-9 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
          <UsersIcon className="h-4 w-4" />
        </div>
        <p>
          <span className="font-semibold text-foreground">People range</span> highlights members near you who recently toggled “I have plans." They might be heading somewhere farther away but still want to coordinate rides.
        </p>
      </div>

      <PeopleCategoryRow selectedCategory={selectedCategory} onCategoryChange={onCategoryChange} />
    </div>
  );
}

type PeopleCategoryRowProps = {
  selectedCategory: CategoryId | null;
  onCategoryChange: (category: CategoryId | null) => void;
};

function PeopleCategoryRow({ selectedCategory, onCategoryChange }: PeopleCategoryRowProps) {
  const options = CATEGORY_ORDER.map((entry) => {
    if (entry === "all") {
      return { id: null, label: "All", Icon: Sparkles };
    }
    const definition = CATEGORY_DEFINITIONS[entry];
    return { id: definition.id, label: definition.label, Icon: definition.icon };
  });

  return (
    <div className="-mx-1">
      <div
        className="flex gap-2 overflow-x-auto px-1 pb-1"
        style={{ WebkitOverflowScrolling: "touch" }}
        aria-label="Filter people by category"
      >
        {options.map(({ id, label, Icon }) => {
          const isActive = selectedCategory === id;
          return (
            <button
              key={label}
              type="button"
              onClick={() => onCategoryChange(id)}
              className={classNames(
                "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                isActive ? "border-primary bg-primary/10 text-primary" : "border-border/70 bg-card/60 text-muted-foreground"
              )}
              aria-pressed={isActive}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function PeopleExplainerPanel() {
  return (
    <section className="hidden items-start gap-3 rounded-3xl border border-primary/20 bg-primary/5 px-5 py-4 text-sm text-muted-foreground md:flex">
      <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
        <UsersIcon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-sm font-medium text-foreground">Coordinate with travelers</p>
        <p className="text-xs text-muted-foreground">
          People nearby surfaces members who signaled an active plan in the last few hours. Distances show how close they are to you, not necessarily where their event happens.
        </p>
      </div>
    </section>
  );
}

type PeopleEmptyStateProps = {
  onResetFilters: () => void;
  filtersActive: boolean;
};

function PeopleEmptyState({ onResetFilters, filtersActive }: PeopleEmptyStateProps) {
  const title = filtersActive ? "No one matches these filters yet" : "No one within this radius yet";
  const description = filtersActive
    ? "Try clearing your category filter or widening your radius to see who's planning something nearby."
    : "Expand your range to 15–20 km and we'll refresh the list. You can shrink it back anytime.";
  const buttonLabel = filtersActive ? "Clear filters" : "Reset to default";

  return (
    <section className="rounded-3xl border border-border/60 bg-card/60 p-8 text-center shadow-xl shadow-black/20">
      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">People range</p>
      <h3 className="mt-3 font-serif text-2xl font-semibold">No one within this radius yet</h3>
      <p className="mt-3 text-sm text-muted-foreground">
        Expand your range to 15–20 km and we’ll refresh the list. You can shrink it back anytime.
      </p>
      <button
        type="button"
        onClick={onResetFilters}
        className="mt-6 rounded-2xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/30 transition hover:opacity-90"
      >
        {buttonLabel}
      </button>
    </section>
  );
}

type PeopleRangeSheetProps = {
  value: number;
  onChange: (value: number) => void;
  onApply: () => void;
  onClose: () => void;
};

function PeopleRangeSheet({ value, onChange, onApply, onClose }: PeopleRangeSheetProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:hidden">
      <button
        type="button"
        className="absolute inset-0 bg-black/70"
        aria-label="Close range selector"
        onClick={onClose}
      />
      <div className="relative w-full max-w-md rounded-t-[32px] border border-white/10 bg-[#060815]/95 px-5 pb-8 pt-6 text-white shadow-[0_-24px_120px_rgba(2,6,23,0.88)]">
        <div className="mx-auto mb-4 h-1 w-16 rounded-full bg-white/15" />
        <div className="space-y-1 text-left">
          <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-white/60">People range</p>
          <h2 className="text-2xl font-serif font-semibold text-white">Tune your radius</h2>
          <p className="text-sm text-white/70">Let Tonight know how far out we should look for fellow planners.</p>
        </div>
        <div className="mt-6 space-y-6">
          <div>
            <div className="flex items-center justify-between text-sm text-white/80">
              <span>Distance</span>
              <span className="font-semibold text-white">{Math.round(value)} km</span>
            </div>
            <SliderPrimitive.Root
              className="relative mt-5 flex h-8 w-full touch-none select-none items-center"
              max={MAX_RANGE_KM}
              min={MIN_RANGE_KM}
              step={1}
              value={[value]}
              aria-label="People radius"
              onValueChange={([next]) => {
                if (typeof next === "number") {
                  onChange(next);
                }
              }}
            >
              <SliderPrimitive.Track className="relative h-2 w-full grow overflow-hidden rounded-full bg-white/12">
                <SliderPrimitive.Range className="absolute h-full rounded-full bg-primary" />
              </SliderPrimitive.Track>
              <SliderPrimitive.Thumb className="block h-5 w-5 rounded-full border-[3px] border-[#050713] bg-white shadow-[0_6px_18px_rgba(0,0,0,0.45)] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60" />
            </SliderPrimitive.Root>
            <div className="mt-2 flex items-center justify-between text-xs text-white/50">
              <span>{MIN_RANGE_KM} km</span>
              <span>{MAX_RANGE_KM} km</span>
            </div>
          </div>
          <button
            type="button"
            onClick={onApply}
            className="w-full rounded-2xl bg-primary py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/30 transition hover:brightness-110"
          >
            Apply radius
          </button>
        </div>
      </div>
    </div>
  );
}

function InitialsAvatar({ initials }: { initials: string }) {
  return (
    <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-border/70 bg-background/60 text-sm font-semibold text-foreground">
      {initials}
    </span>
  );
}
