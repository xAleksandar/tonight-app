"use client";

export function AuthStatusMessage({ label }: { label: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-background via-background/95 to-background px-6 text-center">
      <div className="space-y-3">
        <div className="mx-auto h-10 w-10 animate-pulse rounded-full bg-primary/20" />
        <p className="text-sm font-semibold text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}
