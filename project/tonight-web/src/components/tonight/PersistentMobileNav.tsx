"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { MobileActionBar, type MobileNavTarget } from "./MobileActionBar";

function getActive(pathname: string): MobileNavTarget | null {
  if (pathname === "/") return "discover";
  if (pathname.startsWith("/people")) return "people";
  if (pathname.startsWith("/messages")) return "messages";
  if (pathname.startsWith("/profile")) return "profile";
  return null;
}

function isNavHidden(pathname: string): boolean {
  // Hide on event detail pages (/events/[id]) and the create flow
  return pathname.startsWith("/events/");
}

export function PersistentMobileNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [hidden, setHidden] = useState(() => isNavHidden(pathname));

  useEffect(() => {
    setHidden(isNavHidden(pathname));
  }, [pathname]);

  return (
    <MobileActionBar
      className={`transition-transform duration-300 ease-in-out ${hidden ? "translate-y-full" : "translate-y-0"}`}
      active={getActive(pathname)}
      onCreate={() => router.push("/events/create")}
      onOpenProfile={() => router.push("/profile")}
      onNavigateDiscover={() => router.push("/")}
      onNavigatePeople={() => router.push("/people")}
      onNavigateMessages={() => router.push("/messages")}
    />
  );
}
