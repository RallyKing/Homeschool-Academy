"use client";

import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isIosSafari(): boolean {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent;
  const isIos =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
  return isIos && isSafari;
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in window.navigator &&
      Boolean(
        (window.navigator as Navigator & { standalone?: boolean }).standalone,
      ))
  );
}

export function InstallAppButton() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(
    null,
  );
  const [showIosTip] = useState(() => {
    if (typeof window === "undefined") return false;
    return !isStandalone() && isIosSafari();
  });
  const [installed, setInstalled] = useState(() => {
    if (typeof window === "undefined") return false;
    return isStandalone();
  });

  useEffect(() => {
    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setDeferred(null);
      setInstalled(true);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed) return null;

  const handleInstall = async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
  };

  if (deferred) {
    return (
      <button
        type="button"
        onClick={() => void handleInstall()}
        className="rounded-[var(--radius-sm)] px-2.5 py-1.5 text-sm font-medium text-[var(--muted)] transition-colors duration-200 hover:bg-[var(--accent-soft)] hover:text-[var(--accent)]"
      >
        Install app
      </button>
    );
  }

  if (showIosTip) {
    return (
      <details className="relative px-2.5 py-1.5 text-sm font-medium text-[var(--muted)]">
        <summary className="cursor-pointer list-none rounded-[var(--radius-sm)] hover:text-[var(--accent)]">
          Install app
        </summary>
        <p className="absolute right-0 top-full z-50 mt-1 w-48 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-2 text-xs font-normal text-[var(--muted-fg)] shadow-sm">
          Tap Share, then &quot;Add to Home Screen&quot;.
        </p>
      </details>
    );
  }

  return null;
}
