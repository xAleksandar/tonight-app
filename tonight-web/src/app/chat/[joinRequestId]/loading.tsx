import { SkeletonPulse } from '@/components/loading/SkeletonPulse';

export default function ChatLoadingState() {
  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-zinc-50 via-white to-zinc-100 text-zinc-900" aria-busy="true">
      <header className="sticky top-0 z-30 border-b border-zinc-100 bg-white/80 px-4 py-4 backdrop-blur">
        <div className="mx-auto flex w-full max-w-4xl items-center gap-3">
          <SkeletonPulse className="h-10 w-10 rounded-full" />
          <div className="flex flex-1 flex-col gap-2">
            <SkeletonPulse className="h-4 w-48 rounded-full" />
            <SkeletonPulse className="h-3 w-32 rounded-full" />
          </div>
          <SkeletonPulse className="h-10 w-10 rounded-2xl" />
        </div>
      </header>
      <main className="flex flex-1 justify-center px-4 py-6" aria-live="polite">
        <div className="flex w-full max-w-3xl flex-1 flex-col rounded-3xl border border-zinc-100 bg-white shadow-sm">
          <div className="border-b border-zinc-100 p-6">
            <div className="flex flex-wrap items-center gap-3">
              <div className="space-y-2">
                <SkeletonPulse className="h-3 w-24 rounded-full" />
                <SkeletonPulse className="h-6 w-56 rounded-full" />
                <SkeletonPulse className="h-3 w-40 rounded-full" />
              </div>
              <SkeletonPulse className="h-7 w-36 rounded-full" />
            </div>
            <SkeletonPulse className="mt-4 h-5 w-48 rounded-full" />
          </div>
          <div className="flex flex-1 flex-col">
            <div className="flex-1 space-y-3 overflow-y-hidden px-6 py-6">
              {Array.from({ length: 4 }).map((_, index) => (
                <SkeletonBubble key={`bubble-${index}`} align={index % 2 === 0 ? 'left' : 'right'} />
              ))}
            </div>
            <div className="flex items-center justify-center gap-4 border-t border-zinc-100 bg-zinc-50/80 px-6 py-3">
              <SkeletonPulse className="h-4 w-28 rounded-full" />
              <SkeletonPulse className="h-4 w-24 rounded-full" />
            </div>
            <div className="border-t border-zinc-100 bg-white px-6 py-4">
              <div className="flex items-end gap-3">
                <SkeletonPulse className="min-h-[48px] flex-1 rounded-2xl" />
                <SkeletonPulse className="h-12 w-12 rounded-2xl" />
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

type SkeletonBubbleProps = {
  align: 'left' | 'right';
};

const SkeletonBubble = ({ align }: SkeletonBubbleProps) => (
  <div className={`flex ${align === 'right' ? 'justify-end' : 'justify-start'}`}>
    <SkeletonPulse
      className={`h-16 w-3/4 max-w-md rounded-3xl ${
        align === 'right' ? 'rounded-br-md' : 'rounded-bl-md'
      }`}
    />
  </div>
);
