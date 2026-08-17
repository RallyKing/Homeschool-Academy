"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { ReadAlongParentPanel } from "@/components/ReadAlongParentPanel";
import { Button, PageHeader } from "@/components/ui";

function FamilyReadAlongInner() {
  const family = useQuery(api.users.myFamily);

  if (family === undefined) {
    return <p className="text-sm text-[var(--muted)]">Loading…</p>;
  }

  if (!family) {
    return (
      <div className="page-stack">
        <PageHeader
          title="Read-along"
          description="Create a family first to generate and assign stories."
        />
      </div>
    );
  }

  return (
    <div className="page-stack">
      <div className="flex flex-wrap gap-2">
        <Link href="/family/dashboard">
          <Button variant="ghost" size="sm">
            ← Family
          </Button>
        </Link>
        <Link href="/family/ai">
          <Button variant="ghost" size="sm">
            AI guardrails
          </Button>
        </Link>
      </div>
      <PageHeader
        title="Read-along"
        description="Create story recipes (grade, theme, morals, length — the AI prompt is generated from those fields), then generate and review reading sessions. Students pick a recipe and read with highlighting, tap-to-hear, and optional microphone checking."
      />
      <ReadAlongParentPanel
        familyId={family._id}
        parentGuardrailContext={family.parentGuardrailContext}
      />
    </div>
  );
}

export default function FamilyReadAlongPage() {
  return (
    <Suspense fallback={<p className="text-sm text-[var(--muted)]">Loading…</p>}>
      <FamilyReadAlongInner />
    </Suspense>
  );
}
