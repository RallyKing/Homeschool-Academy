"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Container } from "@/components/ui";

const LAST_SEEN_KEY = "homeschool-lastSeenUpdatesAt";

function subscribeLastSeen(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  return () => window.removeEventListener("storage", onStoreChange);
}

function getLastSeenSnapshot(): number | null {
  try {
    const raw = localStorage.getItem(LAST_SEEN_KEY);
    if (!raw) return null;
    const parsed = Number(raw);
    return Number.isNaN(parsed) ? null : parsed;
  } catch {
    return null;
  }
}

function getLastSeenServerSnapshot(): number | null {
  return null;
}

/** Minimal "new since last visit" banner for parents (and other signed-in users). */
export function WhatsNewBanner() {
  const user = useQuery(api.users.current);
  const [now] = useState(() => Date.now());
  const [dismissed, setDismissed] = useState(false);
  const lastSeen = useSyncExternalStore(
    subscribeLastSeen,
    getLastSeenSnapshot,
    getLastSeenServerSnapshot,
  );

  const updates = useQuery(
    api.productUpdates.listPublished,
    user && lastSeen !== null ? { now, since: lastSeen } : "skip",
  );

  if (!user || dismissed || lastSeen === null || !updates) return null;

  const newOnes = updates.filter(
    (u) => (u.publishedAt ?? u.createdAt) > lastSeen,
  );

  if (newOnes.length === 0) return null;

  if (user.role && user.role !== "parent" && user.role !== "superAdmin") {
    return null;
  }

  return (
    <div className="border-b border-[var(--border)] bg-[var(--accent-soft)] px-4 py-2.5 text-sm text-[var(--accent)]">
      <Container
        size="wide"
        className="flex flex-wrap items-center justify-between gap-2"
      >
        <p>
          {newOnes.length} new product update{newOnes.length === 1 ? "" : "s"}.{" "}
          <Link
            href="/updates"
            className="font-semibold underline-offset-2 hover:underline"
          >
            What&apos;s new
          </Link>
        </p>
        <button
          type="button"
          className="rounded-[var(--radius-sm)] px-2 py-1 font-medium transition-colors hover:bg-[var(--surface)]"
          onClick={() => setDismissed(true)}
        >
          Dismiss
        </button>
      </Container>
    </div>
  );
}
