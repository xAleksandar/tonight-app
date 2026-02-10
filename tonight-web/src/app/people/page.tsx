"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";

import { MessagesModal } from "@/components/chat/MessagesModal";
import { AuthStatusMessage } from "@/components/auth/AuthStatusMessage";
import { DesktopHeader } from "@/components/tonight/DesktopHeader";
import { DesktopSidebar } from "@/components/tonight/DesktopSidebar";
import { MobileActionBar } from "@/components/tonight/MobileActionBar";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import type { CategoryId } from "@/lib/categories";

export default function PeoplePage() {
  const { status: authStatus } = useRequireAuth();

  if (authStatus === "loading") {
    return <AuthStatusMessage label="Checking your session…" />;
  }

  if (authStatus === "unauthenticated") {
    return <AuthStatusMessage label="Redirecting you to the welcome screen…" />;
  }

  if (authStatus === "error") {
    return (
      <AuthStatusMessage label="We couldn't verify your session. Refresh to try again." />
    );
  }

  return <AuthenticatedPeoplePage />;
}

function AuthenticatedPeoplePage() {
  const router = useRouter();
  const [selectedCategory, setSelectedCategory] = useState<CategoryId | null>(
    null,
  );
  const [messagesOpen, setMessagesOpen] = useState(false);
  const handleCreate = useCallback(
    () => router.push("/events/create"),
    [router],
  );

  return (
    <div className="min-h-dvh text-foreground">
      <div className="flex min-h-dvh flex-col md:flex-row">
        <DesktopSidebar
          selectedCategory={selectedCategory}
          onCategoryChange={setSelectedCategory}
          onCreate={handleCreate}
          onNavigateDiscover={() => router.push("/")}
          onNavigatePeople={() => router.push("/people")}
          activePrimaryNav="people"
        />

        <div className="flex flex-1 flex-col">
          <DesktopHeader
            title="People nearby"
            subtitle="See who's open to meeting up tonight"
            onNavigateProfile={() => router.push("/profile")}
            onNavigateMessages={() => setMessagesOpen(true)}
          />

          <main className="flex-1 px-4 pb-28 pt-4 md:px-10 md:pb-12 md:pt-8">
            <div className="mx-auto w-full max-w-4xl space-y-6">
              <section className="rounded-3xl border border-border/60 bg-card/60 p-6 text-center shadow-xl shadow-black/20">
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">
                  Tonight
                </p>
                <h2 className="mt-3 text-3xl font-serif font-semibold">
                  People nearby is on the way
                </h2>
                <p className="mt-3 text-sm text-muted-foreground">
                  We're polishing this section so you can see who else is free
                  tonight. In the meantime, head back to Discover or post your
                  own meetup.
                </p>
                <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => router.push("/")}
                    className="rounded-2xl border border-border/70 px-5 py-2.5 text-sm font-semibold text-foreground transition hover:text-primary"
                  >
                    Back to Discover
                  </button>
                  <button
                    type="button"
                    onClick={handleCreate}
                    className="rounded-2xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/30 transition hover:opacity-90"
                  >
                    Post an event
                  </button>
                </div>
              </section>

              <section className="rounded-3xl border border-dashed border-border/50 bg-card/50 p-6 text-left text-sm text-muted-foreground">
                <h3 className="text-base font-semibold text-foreground">
                  What's coming
                </h3>
                <ul className="mt-3 list-disc space-y-1 pl-5">
                  {[
                    "Browse members who recently checked in nearby",
                    "See who is open to spontaneous hangs tonight",
                    "Send a hi or invite them to your event without leaving the page",
                  ].map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </section>
            </div>
          </main>
        </div>
      </div>

      <MobileActionBar
        active="people"
        onNavigateDiscover={() => router.push("/")}
        onNavigatePeople={() => router.push("/people")}
        onNavigateMessages={() => setMessagesOpen(true)}
        onCreate={handleCreate}
        onOpenProfile={() => router.push("/profile")}
      />

      <MessagesModal
        isOpen={messagesOpen}
        onClose={() => setMessagesOpen(false)}
      />
    </div>
  );
}
