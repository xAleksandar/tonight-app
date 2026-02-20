"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function VerifyPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"idle" | "verifying" | "error">("idle");

  useEffect(() => {
    const token = searchParams?.get("token")?.trim() ?? "";
    if (!token) {
      router.replace("/login?error=missing_token");
      return;
    }

    const verify = async () => {
      setStatus("verifying");
      try {
        await fetch(`/api/auth/verify?token=${encodeURIComponent(token)}`, {
          credentials: "include",
          headers: {
            accept: "application/json",
            "x-auth-verify-client": "1",
          },
        });
        window.location.href = "/";
      } catch (error) {
        setStatus("error");
      }
    };

    void verify();
  }, [router, searchParams]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
      <div className="text-center">
        <p className="text-lg font-semibold">
          {status === "error" ? "Login failed" : "Signing you in…"}
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          {status === "error"
            ? "Please go back and request a new magic link."
            : "This should only take a moment."}
        </p>
      </div>
    </div>
  );
}
