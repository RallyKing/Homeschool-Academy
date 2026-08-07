"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * Syncs an in-page tab with `?tab=` for deep links while preserving other query params.
 */
export function usePageTab<T extends string>(
  tabs: readonly T[],
  defaultTab: T,
  param = "tab",
): [T, (next: T) => void] {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const fromUrl = searchParams.get(param);
  const tab = useMemo(() => {
    if (fromUrl && (tabs as readonly string[]).includes(fromUrl)) {
      return fromUrl as T;
    }
    return defaultTab;
  }, [fromUrl, tabs, defaultTab]);

  const setTab = useCallback(
    (next: T) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next === defaultTab) {
        params.delete(param);
      } else {
        params.set(param, next);
      }
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname, searchParams, defaultTab, param],
  );

  return [tab, setTab];
}
