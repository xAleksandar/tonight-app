import type { HTMLAttributes } from 'react';

const classNames = (...classes: Array<string | boolean | undefined | null>) =>
  classes.filter(Boolean).join(' ');

export function SkeletonPulse({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...props}
      className={classNames(
        'animate-pulse rounded-2xl bg-gradient-to-br from-white/70 via-zinc-100 to-zinc-200/70',
        className
      )}
    />
  );
}
