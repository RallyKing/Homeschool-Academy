"use client";

import { FormEvent, Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { ReadAlongPlayer } from "@/components/ReadAlongPlayer";
import { useViewAsStudentId } from "@/hooks/useViewAsStudentId";
import { withViewAs } from "@/lib/viewAs";
import {
  Badge,
  Button,
  EmptyState,
  Message,
  PageHeader,
  Section,
  Select,
} from "@/components/ui";
import { retainRecipeSelection } from "@/lib/readAlongRecipeSelection";

function StudentReadAlongInner() {
  const viewAsStudentId = useViewAsStudentId();
  const myProfile = useQuery(
    api.students.myProfile,
    viewAsStudentId ? "skip" : {},
  );
  const viewAsContext = useQuery(
    api.students.getViewAsContext,
    viewAsStudentId ? { studentId: viewAsStudentId } : "skip",
  );
  const family = useQuery(api.users.myFamily);

  const profile = viewAsStudentId
    ? (viewAsContext?.student ?? null)
    : (myProfile ?? null);

  const stories = useQuery(
    api.readAlong.listForStudent,
    profile ? { studentId: profile._id } : "skip",
  );
  const sessions = useQuery(
    api.readAlong.listSessionsForStudent,
    profile ? { studentId: profile._id } : "skip",
  );
  const recipes = useQuery(
    api.readAlongRecipes.listActiveForStudent,
    profile ? { studentId: profile._id } : "skip",
  );

  const generateStory = useAction(api.ai.readAlongStory.generate);
  const startSession = useMutation(api.readAlong.startSession);

  const [sessionId, setSessionId] = useState<Id<"readAlongSessions"> | null>(
    null,
  );
  const [recipeId, setRecipeId] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [tone, setTone] = useState<"info" | "error" | "success">("info");
  const [summary, setSummary] = useState<{
    title: string;
    durationMinutes: number;
    wordsCorrect: number;
    wordsMissed: number;
    pointsAwarded: number;
  } | null>(null);

  const inProgress = useMemo(
    () => sessions?.find((s) => s.session.status === "in_progress" || s.session.status === "practice"),
    [sessions],
  );
  const selectedRecipeId = retainRecipeSelection(recipeId, recipes);

  function notify(text: string, next: "info" | "error" | "success" = "success") {
    setMessage(text);
    setTone(next);
  }

  async function onGenerate(e: FormEvent) {
    e.preventDefault();
    if (!profile) return;
    if (!selectedRecipeId) {
      notify("Pick a story recipe first.", "error");
      return;
    }
    setBusy(true);
    try {
      const result = await generateStory({
        studentId: profile._id,
        recipeId: selectedRecipeId as Id<"readAlongRecipes">,
        parentGuardrailContext: family?.parentGuardrailContext,
      });
      notify(`New story: “${result.title}” from ${result.recipeTitle}`);
    } catch (err) {
      notify(err instanceof Error ? err.message : "Could not generate", "error");
    } finally {
      setBusy(false);
    }
  }

  async function begin(storyId: Id<"readAlongStories">) {
    if (!profile) return;
    setBusy(true);
    setSummary(null);
    try {
      // eslint-disable-next-line react-hooks/purity -- click handler, not render
      const startedAt = Date.now();
      const id = await startSession({
        storyId,
        studentId: profile._id,
        startedAt,
      });
      setSessionId(id);
    } catch (err) {
      notify(err instanceof Error ? err.message : "Could not start", "error");
    } finally {
      setBusy(false);
    }
  }

  if (myProfile === undefined && !viewAsStudentId) {
    return <p className="text-sm text-[var(--muted)]">Loading…</p>;
  }
  if (viewAsStudentId && viewAsContext === undefined) {
    return <p className="text-sm text-[var(--muted)]">Loading…</p>;
  }

  if (!profile) {
    return (
      <div className="page-stack">
        <PageHeader
          compact
          eyebrow="Student"
          title="Read-along"
          description="Link your student profile to read stories."
        />
        <Link href={withViewAs("/student/dashboard", viewAsStudentId)}>
          <Button variant="ghost" size="sm">
            ← Today
          </Button>
        </Link>
      </div>
    );
  }

  if (sessionId) {
    return (
      <div className="page-stack">
        <ReadAlongPlayer
          sessionId={sessionId}
          parentGuardrailContext={family?.parentGuardrailContext}
          onExit={() => setSessionId(null)}
          onFinished={(done) => {
            setSummary(done);
            setSessionId(null);
          }}
        />
      </div>
    );
  }

  return (
    <div className="page-stack">
      <div className="flex flex-wrap items-center gap-2">
        <Link href={withViewAs("/student/dashboard", viewAsStudentId)}>
          <Button variant="ghost" size="sm">
            ← Today
          </Button>
        </Link>
        <Link href={withViewAs("/student/dashboard?tab=read", viewAsStudentId)}>
          <Button variant="ghost" size="sm">
            Dashboard tab
          </Button>
        </Link>
      </div>

      <PageHeader
        compact
        eyebrow="Student"
        title="Read-along"
        description="Read a story, hear each word, and practice the ones that were tricky. Time is logged when you finish."
      />

      <Message tone={tone}>{message}</Message>

      {summary ? (
        <Section title="Last session">
          <p className="text-sm">
            <span className="font-medium">{summary.title}</span>
            {` · ${summary.durationMinutes} min · ${summary.wordsCorrect} correct · ${summary.wordsMissed} helped · ${summary.pointsAwarded} points`}
          </p>
        </Section>
      ) : null}

      {inProgress ? (
        <Section title="Continue">
          <div className="list-row">
            <span className="font-medium">{inProgress.storyTitle}</span>
            <Button
              size="sm"
              onClick={() => setSessionId(inProgress.session._id)}
            >
              Resume
            </Button>
          </div>
        </Section>
      ) : null}

      <Section
        title="New story"
        description="Pick a recipe your parent set up (grade, theme, morals, and length). Family reading guidelines still apply."
      >
        {recipes && recipes.length === 0 ? (
          <EmptyState>
            Ask a parent to add a story recipe first — grade level, theme, moral
            lessons, and length.
          </EmptyState>
        ) : (
          <form onSubmit={(e) => void onGenerate(e)} className="space-y-4 max-w-xl">
            <Select
              label="Story recipe"
              value={selectedRecipeId}
              onChange={(e) => setRecipeId(e.target.value)}
              required
            >
              <option value="">Choose…</option>
              {(recipes ?? []).map((r) => (
                <option key={r._id} value={r._id}>
                  {r.title} · grade {r.gradeLevel} · {r.length}
                </option>
              ))}
            </Select>
            <Button type="submit" disabled={busy || !selectedRecipeId}>
              {busy ? "Writing…" : "Generate"}
            </Button>
          </form>
        )}
      </Section>

      <Section title="Your stories">
        {!stories ? (
          <p className="text-sm text-[var(--muted)]">Loading…</p>
        ) : stories.length === 0 ? (
          <EmptyState>Generate a story to start reading.</EmptyState>
        ) : (
          <div className="space-y-1.5">
            {stories.map((story) => (
              <div key={story._id} className="list-row">
                <div className="min-w-0">
                  <p className="font-medium">{story.title}</p>
                  <p className="text-xs text-[var(--muted)]">
                    {story.wordCount} words
                    {story.subject ? ` · ${story.subject}` : ""}
                  </p>
                </div>
                <Button
                  size="sm"
                  disabled={busy}
                  onClick={() => void begin(story._id)}
                >
                  Read
                </Button>
              </div>
            ))}
          </div>
        )}
      </Section>

      {sessions && sessions.length > 0 ? (
        <Section title="Recent sessions">
          <div className="space-y-1.5">
            {sessions.slice(0, 8).map(({ session, storyTitle }) => (
              <div key={session._id} className="list-row list-row-dense">
                <span className="min-w-0 text-sm">{storyTitle}</span>
                <Badge
                  tone={
                    session.status === "completed"
                      ? "success"
                      : session.status === "practice"
                        ? "warning"
                        : "accent"
                  }
                >
                  {session.status.replaceAll("_", " ")}
                </Badge>
              </div>
            ))}
          </div>
        </Section>
      ) : null}
    </div>
  );
}

export default function StudentReadAlongPage() {
  return (
    <Suspense fallback={<p className="text-sm text-[var(--muted)]">Loading…</p>}>
      <StudentReadAlongInner />
    </Suspense>
  );
}
