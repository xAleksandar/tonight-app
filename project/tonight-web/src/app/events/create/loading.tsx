import { SkeletonPulse } from '@/components/loading/SkeletonPulse';

export default function CreateEventLoadingState() {
  return (
    <div className="min-h-screen bg-zinc-50 px-4 py-10 text-zinc-900" aria-busy="true">
      <div className="mx-auto max-w-5xl space-y-8" aria-live="polite">
        <header className="space-y-3">
          <SkeletonPulse className="h-3 w-16 rounded-full" />
          <SkeletonPulse className="h-10 w-1/2 max-w-md" />
          <SkeletonPulse className="h-4 w-2/3 max-w-xl" />
        </header>

        <StatusNoticeSkeleton />

        <section className="rounded-3xl bg-white p-8 shadow-sm">
          <div className="grid gap-6 md:grid-cols-2">
            <FieldSkeleton />
            <FieldSkeleton />
          </div>
          <div className="mt-6 space-y-2">
            <SkeletonPulse className="h-3 w-24 rounded-full" />
            <SkeletonPulse className="h-40 w-full rounded-2xl" />
            <SkeletonPulse className="h-4 w-1/2 rounded-full" />
          </div>
        </section>

        <section className="rounded-3xl bg-white p-8 shadow-sm">
          <div className="grid gap-6 md:grid-cols-2">
            <FieldSkeleton />
            <FieldSkeleton />
          </div>
          <div className="mt-8 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-2">
                <SkeletonPulse className="h-3 w-24 rounded-full" />
                <SkeletonPulse className="h-4 w-40 rounded-full" />
              </div>
              <SkeletonPulse className="h-10 w-36 rounded-full" />
            </div>
            <SkeletonPulse className="h-72 w-full rounded-2xl" />
          </div>
        </section>

        <section className="rounded-3xl bg-white p-8 shadow-sm">
          <SkeletonPulse className="h-3 w-20 rounded-full" />
          <div className="mt-4 space-y-3">
            <SkeletonPulse className="h-5 w-40 rounded-full" />
            <SkeletonPulse className="h-4 w-3/4 rounded-full" />
            <SkeletonPulse className="h-4 w-1/2 rounded-full" />
            <SkeletonPulse className="h-4 w-1/3 rounded-full" />
          </div>
        </section>

        <div className="flex flex-wrap gap-3">
          <SkeletonPulse className="h-12 w-40 rounded-full" />
          <SkeletonPulse className="h-12 w-32 rounded-full" />
        </div>
      </div>
    </div>
  );
}

const FieldSkeleton = () => (
  <div className="space-y-3">
    <SkeletonPulse className="h-3 w-28 rounded-full" />
    <SkeletonPulse className="h-12 w-full rounded-2xl" />
    <SkeletonPulse className="h-3 w-1/2 rounded-full" />
  </div>
);

const StatusNoticeSkeleton = () => (
  <div className="rounded-xl border border-zinc-200 bg-white/70 px-4 py-3">
    <div className="flex items-center gap-3">
      <SkeletonPulse className="h-3 w-3 rounded-full" />
      <SkeletonPulse className="h-3 w-48 rounded-full" />
    </div>
  </div>
);
