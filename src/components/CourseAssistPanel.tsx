"use client";

import { FormEvent, useState } from "react";
import { useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { Badge, Button, Message, Textarea } from "@/components/ui";

/**
 * Stub panel for course_assist — reusable on family AI or student Plan.
 */
export function CourseAssistPanel({
  courseId,
  studentId,
  parentGuardrailContext,
}: {
  courseId: Id<"courses">;
  studentId: Id<"students">;
  parentGuardrailContext: string;
}) {
  const ask = useAction(api.ai.courseAssist.ask);
  const [question, setQuestion] = useState(
    "Can you explain the main idea of today's lesson in simpler words?",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    allowed: boolean;
    answer: string;
    courseTitle: string;
    provider: string;
    reason: string;
  } | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await ask({
        courseId,
        studentId,
        question: question.trim(),
        parentGuardrailContext,
      });
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={(e) => void onSubmit(e)} className="space-y-3">
        <Textarea
          label="Question (this course only)"
          rows={3}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          required
        />
        <Button type="submit" disabled={busy}>
          {busy ? "Thinking…" : "Ask course assistant"}
        </Button>
      </form>
      <Message tone="error">{error}</Message>
      {result ? (
        <div className="space-y-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-2)] p-4">
          <div className="flex flex-wrap gap-2">
            <Badge tone={result.allowed ? "success" : "danger"}>
              {result.allowed ? "On topic" : "Blocked"}
            </Badge>
            <span className="text-xs text-[var(--muted)]">
              {result.courseTitle} · {result.provider}
            </span>
          </div>
          <p className="text-xs text-[var(--muted)]">{result.reason}</p>
          <pre className="whitespace-pre-wrap text-sm">{result.answer}</pre>
        </div>
      ) : null}
    </div>
  );
}
