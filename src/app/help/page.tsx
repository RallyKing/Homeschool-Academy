"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import {
  Button,
  Section,
  Card,
  PageHeader,
  EmptyState,
} from "@/components/ui";

export default function HelpPage() {
  const user = useQuery(api.users.current);
  const articles = useQuery(
    api.knowledgeBase.listPublished,
    user ? {} : "skip",
  );

  if (user === undefined) {
    return <p className="text-sm text-[var(--muted)]">Loading…</p>;
  }
  if (!user) {
    return (
      <p className="text-sm text-[var(--muted)]">
        Please sign in to browse the knowledge base.
      </p>
    );
  }

  const byCategory = new Map<string, typeof articles>();
  for (const a of articles ?? []) {
    const key = a.category ?? "General";
    const list = byCategory.get(key) ?? [];
    list.push(a);
    byCategory.set(key, list);
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Support"
        title="Help"
        description="Knowledge base articles, including docs for each product upgrade."
        actions={
          <Link href="/updates">
            <Button variant="secondary" size="sm">
              What&apos;s new
            </Button>
          </Link>
        }
      />

      {articles === undefined && (
        <p className="text-sm text-[var(--muted)]">Loading…</p>
      )}
      {articles?.length === 0 && (
        <EmptyState>No published articles yet.</EmptyState>
      )}

      {[...byCategory.entries()].map(([category, list]) => (
        <Section key={category} title={category}>
          <Card padding="md">
            <ul className="divide-y divide-[var(--border)]">
              {list?.map((a) => (
                <li key={a._id}>
                  <Link
                    href={`/help/${a.slug}`}
                    className="flex items-center justify-between gap-3 py-3 text-sm font-medium text-[var(--foreground)] transition-colors hover:text-[var(--accent)]"
                  >
                    {a.title}
                    <span className="text-[var(--muted)]" aria-hidden>
                      →
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        </Section>
      ))}
    </div>
  );
}
