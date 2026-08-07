"use client";

import { ConvexAuthNextjsProvider } from "@convex-dev/auth/nextjs";
import { ConvexReactClient } from "convex/react";
import { ReactNode, useMemo } from "react";

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  const convex = useMemo(() => {
    const url = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!url) {
      console.warn(
        "NEXT_PUBLIC_CONVEX_URL is not set. Run `npx convex dev` and copy the URL to .env.local.",
      );
      return new ConvexReactClient("https://placeholder.convex.cloud");
    }
    return new ConvexReactClient(url);
  }, []);

  return (
    <ConvexAuthNextjsProvider client={convex}>{children}</ConvexAuthNextjsProvider>
  );
}
