export type ServiceWorkerLike = {
  getRegistrations: () => Promise<Array<{ unregister: () => Promise<boolean> }>>;
};

export type CacheStorageLike = {
  keys: () => Promise<string[]>;
  delete: (key: string) => Promise<boolean>;
};

export function cacheBustHref(href: string, now: number): string {
  const url = new URL(href);
  url.searchParams.set("_fresh", String(now));
  return url.toString();
}

export async function unregisterServiceWorkers(
  sw: ServiceWorkerLike | undefined,
): Promise<number> {
  if (!sw) return 0;
  const regs = await sw.getRegistrations();
  await Promise.all(regs.map((reg) => reg.unregister()));
  return regs.length;
}

export async function clearCacheStorage(
  caches: CacheStorageLike | undefined,
): Promise<number> {
  if (!caches) return 0;
  const keys = await caches.keys();
  await Promise.all(keys.map((key) => caches.delete(key)));
  return keys.length;
}

export async function hardRefresh(deps: {
  serviceWorker: ServiceWorkerLike | undefined;
  caches: CacheStorageLike | undefined;
  href: string;
  now: number;
  replace: (url: string) => void;
}): Promise<void> {
  await unregisterServiceWorkers(deps.serviceWorker);
  await clearCacheStorage(deps.caches);
  deps.replace(cacheBustHref(deps.href, deps.now));
}

export async function hardRefreshFromWindow(
  win: Window = window,
): Promise<void> {
  const nav = win.navigator as Navigator & {
    serviceWorker?: ServiceWorkerLike;
  };
  await hardRefresh({
    serviceWorker: nav.serviceWorker,
    caches: "caches" in win ? win.caches : undefined,
    href: win.location.href,
    now: Date.now(),
    replace: (url) => {
      win.location.replace(url);
    },
  });
}
