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
    <div className="page-stack">
      <PageHeader
        compact
        eyebrow="Support"
        title="Knowledge base"
        description="Help articles for product upgrades and how-to guides."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/updates">
              <Button variant="secondary" size="sm">
                What&apos;s new
              </Button>
            </Link>
            {user.role === "superAdmin" && (
              <Link href="/admin/knowledge-base">
                <Button variant="ghost" size="sm">
                  Manage KB
                </Button>
              </Link>
            )}
          </div>
        }
      />

      {articles === undefined && (
        <p className="text-sm text-[var(--muted)]">Loading…</p>
      )}
      {articles?.length === 0 && (
        <EmptyState>
          No published knowledge base articles yet. Check{" "}
          <Link
            href="/updates"
            className="hover-link font-medium text-[var(--accent)] underline-offset-2"
          >
            What&apos;s new
          </Link>{" "}
          for product updates.
        </EmptyState>
      )}

      {[...byCategory.entries()].map(([category, list]) => (
        <Section key={category} title={category}>
          <Card padding="md">
            <ul className="divide-y divide-[var(--border)]">
              {list?.map((a) => (
                <li key={a._id}>
                  <Link
                    href={`/help/${a.slug}`}
                    className="hover-fade flex items-center justify-between gap-3 py-3 text-sm font-medium text-[var(--foreground)] hover:text-[var(--accent)]"
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
