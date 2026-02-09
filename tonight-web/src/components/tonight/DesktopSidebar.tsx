"use client";

import { useState } from "react";
import {
  ChevronDown,
  Compass,
  Plus,
  Sparkles,
  Users,
} from "lucide-react";

import { CATEGORY_DEFINITIONS, CATEGORY_ORDER, type CategoryId } from "@/lib/categories";
import { classNames } from "@/lib/classNames";

export type DesktopSidebarProps = {
  selectedCategory: CategoryId | null;
  onCategoryChange: (category: CategoryId | null) => void;
  onCreate: () => void;
};

export function DesktopSidebar({ selectedCategory, onCategoryChange, onCreate }: DesktopSidebarProps) {
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const activeCategory = selectedCategory ? CATEGORY_DEFINITIONS[selectedCategory] : null;
  const ActiveIcon = activeCategory?.icon ?? Sparkles;

  return (
    <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 border-r border-white/10 bg-card/30 px-5 py-6 text-foreground backdrop-blur-2xl md:flex md:flex-col">
      <div className="flex items-center gap-3 px-1">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/90 text-primary-foreground shadow-lg shadow-primary/30">
          <Sparkles className="h-5 w-5" />
        </div>
        <div>
          <p className="text-lg font-serif font-semibold leading-tight">tonight</p>
          <p className="text-xs text-muted-foreground">Meetups in real life</p>
        </div>
      </div>

      <nav className="mt-8 space-y-1 text-sm" aria-label="Primary">
        <button
          type="button"
          className="flex w-full items-center gap-3 rounded-xl bg-primary/10 px-3 py-2.5 font-medium text-primary transition-all"
        >
          <Compass className="h-4.5 w-4.5" />
          Discover
        </button>
        <button
          type="button"
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 font-medium text-muted-foreground/70"
          disabled
        >
          <Users className="h-4.5 w-4.5" />
          People nearby
        </button>
      </nav>

      <div className="mt-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Categories</p>
        <button
          type="button"
          className="mt-3 flex w-full items-center gap-3 rounded-xl border border-border/80 bg-background/40 px-3 py-2 text-left text-sm font-medium text-foreground transition-all"
          onClick={() => setCategoriesOpen((value) => !value)}
        >
          <span className="rounded-lg bg-card/70 p-1.5 text-muted-foreground">
            <ActiveIcon className="h-4 w-4" />
          </span>
          <span className="flex-1">{selectedCategory ? activeCategory?.label : "All"}</span>
          <ChevronDown
            className={classNames(
              "h-4 w-4 text-muted-foreground transition-transform",
              categoriesOpen && "rotate-180"
            )}
          />
        </button>
        {categoriesOpen && (
          <div className="ml-1 mt-2 flex flex-col gap-0.5 border-l border-border/60 pl-3">
            {CATEGORY_ORDER.map((entry) => {
              if (entry === "all") {
                return (
                  <button
                    key="all"
                    type="button"
                    onClick={() => {
                      onCategoryChange(null);
                      setCategoriesOpen(false);
                    }}
                    className={classNames(
                      "flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold",
                      selectedCategory === null
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    All
                  </button>
                );
              }
              const definition = CATEGORY_DEFINITIONS[entry];
              const Icon = definition.icon;
              return (
                <button
                  key={definition.id}
                  type="button"
                  onClick={() => {
                    onCategoryChange(definition.id);
                    setCategoriesOpen(false);
                  }}
                  className={classNames(
                    "flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold",
                    selectedCategory === definition.id
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {definition.label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={onCreate}
        className="mt-auto flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/30 transition hover:opacity-90"
      >
        <Plus className="h-4 w-4" />
        Post event
      </button>
    </aside>
  );
}
