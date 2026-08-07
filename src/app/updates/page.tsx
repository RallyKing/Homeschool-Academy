"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import {
  Button,
  Section,
  Card,
  PageHeader,
  Badge,
  EmptyState,
} from "@/components/ui";

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

export default function UpdatesPage() {
  const user = useQuery(api.users.current);
  const [now] = useState(() => Date.now());
  const lastSeen = useSyncExternalStore(
    subscribeLastSeen,
    getLastSeenSnapshot,
    getLastSeenServerSnapshot,
  );

  const updates = useQuery(
    api.productUpdates.listPublished,
    user ? { now } : "skip",
  );

  useEffect(() => {
    if (!updates || updates.length === 0) return;
    try {
      localStorage.setItem(LAST_SEEN_KEY, String(now));
      window.dispatchEvent(new Event("storage"));
    } catch {
      // ignore
    }
  }, [updates, now]);

  if (user === undefined) {
    return <p className="text-sm text-[var(--muted)]">Loading…</p>;
  }
  if (!user) {
    return <p className="text-sm text-[var(--muted)]">Please sign in to view product updates.</p>;
  }

  const newCount =
    lastSeen === null
      ? 0
      : (updates?.filter((u) => (u.publishedAt ?? u.createdAt) > lastSeen)
          .length ?? 0);

  return (
    <div className="page-stack">
      <PageHeader
        compact
        eyebrow="Product"
        title="What's new"
        description="Product upgrades and platform changes."
        actions={
          <Link href="/help">
            <Button variant="secondary" size="sm">
              Browse help
            </Button>
          </Link>
        }
      />

      {newCount > 0 && (
        <Badge tone="accent">{newCount} new since your last visit</Badge>
      )}

      <Section title="Updates">
        {updates === undefined && (
          <p className="text-sm text-[var(--muted)]">Loading…</p>
        )}
        {updates?.length === 0 && (
          <EmptyState>No published updates yet.</EmptyState>
        )}

        <div className="space-y-4">
          {updates?.map((u) => {
            const at = u.publishedAt ?? u.createdAt;
            const isNew = lastSeen !== null && at > lastSeen;
            return (
              <Card key={u._id} padding="lg" className="animate-fade-up">
                <div className="flex flex-wrap items-baseline gap-2">
                  <h2 className="font-display text-lg font-semibold">{u.title}</h2>
                  {isNew && <Badge tone="accent">New</Badge>}
                  {u.version && (
                    <Badge tone="neutral">
                      v{u.version.replace(/^v/i, "")}
                    </Badge>
                  )}
                </div>
                <p className="mt-2 text-sm text-[var(--muted)]">{u.summary}</p>
                <div className="mt-4 rounded-[var(--radius-md)] bg-[var(--surface-2)] p-4">
                  <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-[var(--foreground)]">
                    {u.body}
                  </pre>
                </div>
                {u.knowledgeBaseArticleId && (
                  <div className="mt-4">
                    <Link href="/help">
                      <Button variant="ghost" size="sm">
                        Browse knowledge base
                      </Button>
                    </Link>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      </Section>
    </div>
  );
}
