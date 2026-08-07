"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui";

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
      <Button variant="ghost" size="sm" onClick={() => void handleInstall()}>
        Install app
      </Button>
    );
  }

  if (showIosTip) {
    return (
      <details className="text-sm text-[var(--muted)]">
        <summary className="cursor-pointer list-none rounded-[var(--radius-sm)] px-2.5 py-1.5 font-medium transition-colors hover:bg-[var(--accent-soft)] hover:text-[var(--accent)]">
          Install app
        </summary>
        <p className="mt-1 max-w-48 px-2 text-xs text-[var(--muted-fg)]">
          Tap Share, then &quot;Add to Home Screen&quot;.
        </p>
      </details>
    );
  }

  return null;
}
