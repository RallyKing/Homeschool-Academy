"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import {
  Button,
  Card,
  PageHeader,
  Badge,
  EmptyState,
} from "@/components/ui";

export default function HelpArticlePage() {
  const params = useParams();
  const slug = typeof params.slug === "string" ? params.slug : "";
  const user = useQuery(api.users.current);
  const article = useQuery(
    api.knowledgeBase.getBySlug,
    user && slug ? { slug } : "skip",
  );

  if (user === undefined) {
    return <p className="text-sm text-[var(--muted)]">Loading…</p>;
  }
  if (!user) {
    return <p className="text-sm text-[var(--muted)]">Please sign in to read this article.</p>;
  }
  if (article === undefined) {
    return <p className="text-sm text-[var(--muted)]">Loading…</p>;
  }
  if (article === null) {
    return (
      <div className="space-y-6">
        <PageHeader title="Article not found" />
        <EmptyState>
          This article may have been removed or is not published.
        </EmptyState>
        <Link href="/help">
          <Button variant="secondary" size="sm">
            Back to Help
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <article className="space-y-8 animate-fade-up">
      <PageHeader
        eyebrow={article.category ?? "Help"}
        title={article.title}
        actions={
          <Link href="/help">
            <Button variant="ghost" size="sm">
              ← All articles
            </Button>
          </Link>
        }
      />

      <Card padding="lg">
        <div className="prose-sm max-w-none">
          <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-[var(--foreground)]">
            {article.body}
          </pre>
        </div>
      </Card>

      {article.productUpdateId && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-[var(--muted)]">Related:</span>
          <Link href="/updates">
            <Button variant="ghost" size="sm">
              Product updates
            </Button>
          </Link>
          <Badge tone="accent">Upgrade doc</Badge>
        </div>
      )}
    </article>
  );
}
