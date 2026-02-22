"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export function SafeAreaTint() {
  const pathname = usePathname();

  useEffect(() => {
    const isDiscover = pathname === "/";
    document.body.dataset.safeArea = isDiscover ? "discover" : "default";

    return () => {
      delete document.body.dataset.safeArea;
    };
  }, [pathname]);

  return null;
}
