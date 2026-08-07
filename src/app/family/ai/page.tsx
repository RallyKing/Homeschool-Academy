"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useAction, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";

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
    return <p className="text-sm text-neutral-500">Loading…</p>;
  }

  if (!user) {
    return <p className="text-sm">Please sign in.</p>;
  }

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm">
          <Link href="/family/dashboard" className="underline">
            ← Family
          </Link>
        </p>
        <h1 className="mt-2 text-2xl font-semibold">AI guardrails demo</h1>
        <p className="text-sm text-neutral-600">
          Student prompt + parent context → constrained response. Uses OpenAI
          when <code className="text-xs">OPENAI_API_KEY</code> is set on Convex;
          otherwise a deterministic mock.
        </p>
      </div>

      <form onSubmit={(e) => void onSubmit(e)} className="space-y-3">
        <label className="block text-sm">
          Parent guardrail context
          <textarea
            className="mt-1 w-full border border-neutral-300 px-2 py-1.5"
            rows={3}
            value={parentGuardrailContext}
            onChange={(e) => setParentGuardrailContext(e.target.value)}
            required
          />
        </label>
        <label className="block text-sm">
          Student prompt
          <textarea
            className="mt-1 w-full border border-neutral-300 px-2 py-1.5"
            rows={3}
            value={studentPrompt}
            onChange={(e) => setStudentPrompt(e.target.value)}
            required
          />
        </label>
        <button
          type="submit"
          disabled={busy}
          className="border border-neutral-900 bg-neutral-900 px-3 py-1.5 text-sm text-white disabled:opacity-50"
        >
          {busy ? "Checking…" : "Run guardrails"}
        </button>
      </form>

      {error && <p className="text-sm text-red-700">{error}</p>}

      {result && (
        <section className="space-y-2 border-t border-neutral-200 pt-4 text-sm">
          <p>
            <span className="font-medium">
              {result.allowed ? "Allowed" : "Blocked"}
            </span>
            {" · "}
            provider: {result.provider}
          </p>
          <p className="text-neutral-600">{result.reason}</p>
          {result.filteredTopics.length > 0 && (
            <p>Filtered: {result.filteredTopics.join(", ")}</p>
          )}
          <pre className="whitespace-pre-wrap border border-neutral-200 bg-white p-3 text-neutral-800">
            {result.response}
          </pre>
          <p className="text-neutral-500">
            Tip: try a prompt containing &quot;weapon&quot; or a blocked term
            from your context to see a refusal.
          </p>
        </section>
      )}
    </div>
  );
}
