import type { LucideIcon } from "lucide-react";
import {
  Clapperboard,
  Coffee,
  Dumbbell,
  Music,
  UtensilsCrossed,
  Waves,
} from "lucide-react";

export type CategoryId = "cinema" | "food" | "outdoor" | "music" | "fitness" | "social";

export type CategoryDefinition = {
  id: CategoryId;
  label: string;
  keywords: string[];
  icon: LucideIcon;
  accent: string;
  badge: string;
};

export const CATEGORY_DEFINITIONS: Record<CategoryId, CategoryDefinition> = {
  cinema: {
    id: "cinema",
    label: "Cinema",
    keywords: ["movie", "film", "cinema", "theater"],
    icon: Clapperboard,
    accent: "bg-sky-500/15 text-sky-200 border-sky-400/30",
    badge: "border border-sky-400/30 bg-sky-500/10 text-sky-100",
  },
  food: {
    id: "food",
    label: "Food",
    keywords: ["dinner", "eat", "restaurant", "food", "sushi", "pizza", "brunch"],
    icon: UtensilsCrossed,
    accent: "bg-amber-500/15 text-amber-200 border-amber-400/30",
    badge: "border border-amber-400/30 bg-amber-500/10 text-amber-100",
  },
  outdoor: {
    id: "outdoor",
    label: "Outdoor",
    keywords: ["walk", "hike", "outdoor", "park", "beach"],
    icon: Waves,
    accent: "bg-emerald-500/15 text-emerald-200 border-emerald-400/30",
    badge: "border border-emerald-400/30 bg-emerald-500/10 text-emerald-100",
  },
  music: {
    id: "music",
    label: "Music",
    keywords: ["music", "concert", "band", "dj", "jazz"],
    icon: Music,
    accent: "bg-rose-500/15 text-rose-200 border-rose-400/30",
    badge: "border border-rose-400/30 bg-rose-500/10 text-rose-100",
  },
  fitness: {
    id: "fitness",
    label: "Fitness",
    keywords: ["gym", "workout", "run", "yoga", "fitness"],
    icon: Dumbbell,
    accent: "bg-lime-500/15 text-lime-200 border-lime-400/30",
    badge: "border border-lime-400/30 bg-lime-500/10 text-lime-100",
  },
  social: {
    id: "social",
    label: "Social",
    keywords: ["coffee", "board game", "hang", "meet", "social", "drink"],
    icon: Coffee,
    accent: "bg-orange-500/15 text-orange-200 border-orange-400/30",
    badge: "border border-orange-400/30 bg-orange-500/10 text-orange-100",
  },
};

export const CATEGORY_ORDER: (CategoryId | "all")[] = [
  "all",
  "cinema",
  "food",
  "outdoor",
  "music",
  "fitness",
  "social",
];
