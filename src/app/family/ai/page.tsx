"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useAction, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import {
  Button,
  Textarea,
  Section,
  Card,
  PageHeader,
  Badge,
  Message,
} from "@/components/ui";

export default function FamilyAiPage() {
  const user = useQuery(api.users.current);
  const filterPrompt = useAction(api.ai.filterPrompt);

  const [studentPrompt, setStudentPrompt] = useState(
    "Can you help me understand fractions?",
  );
  const [parentGuardrailContext, setParentGuardrailContext] = useState(
    "Focus on STEM and reading. Age-appropriate only. block: dating, weapons",
  );
  const [result, setResult] = useState<{
    allowed: boolean;
    response: string;
    filteredTopics: string[];
    reason: string;
    provider: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await filterPrompt({
        studentPrompt: studentPrompt.trim(),
        parentGuardrailContext: parentGuardrailContext.trim(),
      });
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  if (user === undefined) {
    return <p className="text-sm text-[var(--muted)]">Loading…</p>;
  }

  if (!user) {
    return <p className="text-sm text-[var(--muted)]">Please sign in.</p>;
  }

  return (
    <div className="space-y-8">
      <Link href="/family/dashboard">
        <Button variant="ghost" size="sm">
          ← Family
        </Button>
      </Link>

      <PageHeader
        title="AI guardrails demo"
        description="Student prompt + parent context → constrained response. Uses OpenAI when OPENAI_API_KEY is set on Convex; otherwise a deterministic mock."
      />

      <Section title="Test guardrails">
        <Card>
          <form onSubmit={(e) => void onSubmit(e)} className="space-y-4">
            <Textarea
              label="Parent guardrail context"
              rows={3}
              value={parentGuardrailContext}
              onChange={(e) => setParentGuardrailContext(e.target.value)}
              required
            />
            <Textarea
              label="Student prompt"
              rows={3}
              value={studentPrompt}
              onChange={(e) => setStudentPrompt(e.target.value)}
              required
            />
            <Button type="submit" disabled={busy}>
              {busy ? "Checking…" : "Run guardrails"}
            </Button>
          </form>
        </Card>
      </Section>

      <Message tone="error">{error}</Message>

      {result && (
        <Section title="Result">
          <Card className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={result.allowed ? "success" : "danger"}>
                {result.allowed ? "Allowed" : "Blocked"}
              </Badge>
              <span className="text-sm text-[var(--muted)]">
                provider: {result.provider}
              </span>
            </div>
            <p className="text-sm text-[var(--muted)]">{result.reason}</p>
            {result.filteredTopics.length > 0 && (
              <p className="text-sm text-[var(--foreground)]">
                Filtered: {result.filteredTopics.join(", ")}
              </p>
            )}
            <pre className="whitespace-pre-wrap rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-2)] p-4 text-sm text-[var(--foreground)]">
              {result.response}
            </pre>
            <p className="text-xs text-[var(--muted)]">
              Tip: try a prompt containing &quot;weapon&quot; or a blocked term
              from your context to see a refusal.
            </p>
          </Card>
        </Section>
      )}
    </div>
  );
}
