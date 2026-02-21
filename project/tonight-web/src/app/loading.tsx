import { SkeletonPulse } from '@/components/loading/SkeletonPulse';

export default function AppLoadingState() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-50 via-white to-zinc-50 px-4 py-10 text-zinc-900" aria-busy="true">
      <div className="mx-auto max-w-6xl space-y-8" aria-live="polite">
        <header className="space-y-4">
          <SkeletonPulse className="h-3 w-20 rounded-full" />
          <div className="space-y-3">
            <SkeletonPulse className="h-10 w-2/3 max-w-xl" />
            <SkeletonPulse className="h-4 w-full max-w-2xl" />
            <SkeletonPulse className="h-4 w-11/12 max-w-3xl" />
          </div>
          <div className="flex flex-wrap gap-3">
            <SkeletonPulse className="h-11 w-32 rounded-full" />
            <SkeletonPulse className="h-11 w-36 rounded-full" />
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-2">
          <SkeletonCard />
          <SkeletonCard />
        </section>

        <section className="rounded-3xl border border-zinc-100 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-2">
              <SkeletonPulse className="h-3 w-24 rounded-full" />
              <SkeletonPulse className="h-4 w-40 rounded-full" />
            </div>
            <div className="inline-flex gap-2 rounded-full border border-zinc-100 bg-zinc-50 p-1">
              <SkeletonPulse className="h-10 w-24 rounded-full" />
              <SkeletonPulse className="h-10 w-24 rounded-full" />
            </div>
          </div>
          <div className="mt-6 space-y-4">
            <SkeletonPulse className="h-5 w-1/4 rounded-full" />
            <SkeletonPulse className="h-[320px] w-full rounded-2xl" />
            <div className="grid gap-3 md:grid-cols-2">
              <SkeletonPulse className="h-24 w-full rounded-2xl" />
              <SkeletonPulse className="h-24 w-full rounded-2xl" />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

const SkeletonCard = () => (
  <div className="rounded-3xl border border-zinc-100 bg-white p-5 shadow-sm">
    <div className="space-y-3">
      <SkeletonPulse className="h-3 w-28 rounded-full" />
      <SkeletonPulse className="h-5 w-40 rounded-full" />
      <SkeletonPulse className="h-4 w-3/4 rounded-full" />
      <SkeletonPulse className="h-3 w-1/2 rounded-full" />
    </div>
  </div>
);
