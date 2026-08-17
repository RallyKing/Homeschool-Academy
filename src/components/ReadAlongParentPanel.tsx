"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import {
  Badge,
  Button,
  EmptyState,
  Input,
  Message,
  Modal,
  Section,
  Select,
  TabPanel,
  Tabs,
  Textarea,
} from "@/components/ui";
import { ReadAlongRecipePanel } from "@/components/ReadAlongRecipePanel";

function formatWhen(ms: number): string {
  try {
    return new Date(ms).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export function ReadAlongParentPanel({
  familyId,
  studentId,
  parentGuardrailContext,
}: {
  familyId: Id<"families">;
  studentId?: Id<"students">;
  parentGuardrailContext?: string;
}) {
  const students = useQuery(api.students.listForMyFamily);
  const stories = useQuery(api.readAlong.listForFamily, {
    familyId,
    studentId,
  });
  const sessions = useQuery(api.readAlong.listSessionsForFamily, {
    familyId,
    studentId,
  });
  const recipes = useQuery(api.readAlongRecipes.listForFamily, {
    familyId,
    activeOnly: true,
  });

  const generateStory = useAction(api.ai.readAlongStory.generate);
  const createStory = useMutation(api.readAlong.create);
  const updateStory = useMutation(api.readAlong.update);
  const removeStory = useMutation(api.readAlong.remove);
  const removeSession = useMutation(api.readAlong.removeSession);

  const [message, setMessage] = useState<string | null>(null);
  const [tone, setTone] = useState<"info" | "error" | "success">("info");
  const [busy, setBusy] = useState(false);
  const [genStudentId, setGenStudentId] = useState(studentId ?? "");
  const [recipeId, setRecipeId] = useState("");
  const [panelTab, setPanelTab] = useState<"recipes" | "stories" | "sessions">(
    "recipes",
  );

  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState<Id<"readAlongStories"> | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");
  const [editStudentId, setEditStudentId] = useState("");
  const [manualOpen, setManualOpen] = useState(false);

  const studentOptions = useMemo(() => students ?? [], [students]);

  function notify(text: string, next: "info" | "error" | "success" = "success") {
    setMessage(text);
    setTone(next);
  }

  async function onGenerate(e: FormEvent) {
    e.preventDefault();
    const sid = (studentId ?? genStudentId) as Id<"students"> | "";
    if (!sid) {
      notify("Pick a student first.", "error");
      return;
    }
    if (!recipeId) {
      notify("Pick a story recipe first.", "error");
      return;
    }
    setBusy(true);
    try {
      const result = await generateStory({
        studentId: sid,
        recipeId: recipeId as Id<"readAlongRecipes">,
        parentGuardrailContext,
      });
      notify(
        `Story ready: “${result.title}” from ${result.recipeTitle} (${result.wordCount} words, ${result.provider}).`,
      );
      setPanelTab("stories");
    } catch (err) {
      notify(err instanceof Error ? err.message : "Generate failed", "error");
    } finally {
      setBusy(false);
    }
  }

  function openEdit(story: {
    _id: Id<"readAlongStories">;
    title: string;
    body: string;
    studentId?: Id<"students">;
  }) {
    setEditId(story._id);
    setEditTitle(story.title);
    setEditBody(story.body);
    setEditStudentId(story.studentId ?? "");
    setEditOpen(true);
  }

  function openManual() {
    setEditId(null);
    setEditTitle("");
    setEditBody("");
    setEditStudentId(studentId ?? "");
    setManualOpen(true);
  }

  async function onSaveStory(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (editId) {
        await updateStory({
          storyId: editId,
          title: editTitle,
          body: editBody,
          studentId: studentId
            ? studentId
            : editStudentId
              ? (editStudentId as Id<"students">)
              : null,
        });
        notify("Story updated.");
        setEditOpen(false);
      } else {
        await createStory({
          familyId,
          studentId: editStudentId
            ? (editStudentId as Id<"students">)
            : undefined,
          title: editTitle,
          body: editBody,
        });
        notify("Story added.");
        setManualOpen(false);
      }
    } catch (err) {
      notify(err instanceof Error ? err.message : "Save failed", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <Message tone={tone}>{message}</Message>

      <Tabs
        tabs={[
          { id: "recipes", label: "Story recipes", count: recipes?.length },
          { id: "stories", label: "Stories" },
          { id: "sessions", label: "Sessions" },
        ]}
        value={panelTab}
        onChange={(id) =>
          setPanelTab(id as "recipes" | "stories" | "sessions")
        }
      />

      <TabPanel id="recipes" active={panelTab === "recipes"}>
        <ReadAlongRecipePanel familyId={familyId} />
      </TabPanel>

      <TabPanel id="stories" active={panelTab === "stories"}>
      <Section
        title="Generate a story"
        description="Students pick a recipe, then generate. Grade, theme, morals, and length (plus the generated prompt) control what the AI writes."
      >
        <form onSubmit={(e) => void onGenerate(e)} className="space-y-4 max-w-xl">
          {!studentId ? (
            <Select
              label="Student"
              value={genStudentId}
              onChange={(e) => setGenStudentId(e.target.value)}
              required
            >
              <option value="">Choose…</option>
              {studentOptions.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.displayName}
                  {s.academicLevel ? ` · ${s.academicLevel}` : ""}
                </option>
              ))}
            </Select>
          ) : null}
          <Select
            label="Story recipe"
            value={recipeId}
            onChange={(e) => setRecipeId(e.target.value)}
            required
          >
            <option value="">Choose a recipe…</option>
            {(recipes ?? []).map((r) => (
              <option key={r._id} value={r._id}>
                {r.title} · grade {r.gradeLevel} · {r.length}
              </option>
            ))}
          </Select>
          {recipes && recipes.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">
              Create a recipe on the Story recipes tab first (or add starter recipes).
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={busy || !recipes?.length}>
              {busy ? "Working…" : "Generate story"}
            </Button>
            <Button type="button" variant="secondary" onClick={openManual}>
              Write one
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setPanelTab("recipes")}
            >
              Edit recipes
            </Button>
          </div>
        </form>
      </Section>

      <Section title="Stories">
        {!stories ? (
          <p className="text-sm text-[var(--muted)]">Loading…</p>
        ) : stories.length === 0 ? (
          <EmptyState>No stories yet — generate or write one.</EmptyState>
        ) : (
          <div className="space-y-1.5">
            {stories.map((story) => (
              <div key={story._id} className="list-row">
                <div className="min-w-0">
                  <p className="font-medium">{story.title}</p>
                  <p className="text-xs text-[var(--muted)]">
                    {story.wordCount} words
                    {story.ageBand ? ` · ${story.ageBand.replaceAll("_", " ")}` : ""}
                    {story.studentId ? "" : " · family library"}
                  </p>
                </div>
                <span className="flex flex-wrap gap-1.5">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => openEdit(story)}
                  >
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => {
                      if (!window.confirm("Delete this story and its sessions?"))
                        return;
                      void removeStory({ storyId: story._id })
                        .then(() => notify("Story deleted."))
                        .catch((err) =>
                          notify(
                            err instanceof Error ? err.message : "Failed",
                            "error",
                          ),
                        );
                    }}
                  >
                    Delete
                  </Button>
                </span>
              </div>
            ))}
          </div>
        )}
      </Section>
      </TabPanel>

      <TabPanel id="sessions" active={panelTab === "sessions"}>
      <Section
        title="Sessions"
        description="Time, words correct, helped words, and points. Deleting a session reverses its read-along points."
      >
        {!sessions ? (
          <p className="text-sm text-[var(--muted)]">Loading…</p>
        ) : sessions.length === 0 ? (
          <EmptyState>No sessions yet.</EmptyState>
        ) : (
          <div className="space-y-1.5">
            {sessions.map(({ session, storyTitle, studentName }) => (
              <div key={session._id} className="list-row">
                <div className="min-w-0">
                  <p className="font-medium">
                    {storyTitle}
                    <span className="ml-2 text-xs font-normal text-[var(--muted)]">
                      {studentName}
                    </span>
                  </p>
                  <p className="text-xs text-[var(--muted)]">
                    {formatWhen(session.startedAt)}
                    {session.durationMs != null
                      ? ` · ${Math.max(1, Math.round(session.durationMs / 60000))} min`
                      : ""}
                    {` · ${session.wordsCorrect} correct · ${session.wordsMissed} helped · ${session.pointsAwarded} pts`}
                  </p>
                </div>
                <span className="flex items-center gap-2">
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
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => {
                      if (!window.confirm("Delete this session and reverse points?"))
                        return;
                      void removeSession({ sessionId: session._id })
                        .then(() => notify("Session deleted."))
                        .catch((err) =>
                          notify(
                            err instanceof Error ? err.message : "Failed",
                            "error",
                          ),
                        );
                    }}
                  >
                    Delete
                  </Button>
                </span>
              </div>
            ))}
          </div>
        )}
      </Section>
      </TabPanel>

      <p className="text-sm text-[var(--muted)]">
        Students open{" "}
        <Link href="/student/read-along" className="text-[var(--accent)]">
          Read-along
        </Link>{" "}
        (or Today → Read). Preview as a student from their control page.
      </p>

      <Modal
        open={editOpen || manualOpen}
        onClose={() => {
          setEditOpen(false);
          setManualOpen(false);
        }}
        title={editId ? "Edit story" : "Write a story"}
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => {
                setEditOpen(false);
                setManualOpen(false);
              }}
            >
              Cancel
            </Button>
            <Button type="submit" form="read-along-story-form" disabled={busy}>
              Save
            </Button>
          </>
        }
      >
        <form
          id="read-along-story-form"
          onSubmit={(e) => void onSaveStory(e)}
          className="space-y-4"
        >
          <Input
            label="Title"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            required
          />
          <Textarea
            label="Story"
            rows={8}
            value={editBody}
            onChange={(e) => setEditBody(e.target.value)}
            required
          />
          {!studentId ? (
            <Select
              label="Assign to"
              value={editStudentId}
              onChange={(e) => setEditStudentId(e.target.value)}
            >
              <option value="">Family library (any child)</option>
              {studentOptions.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.displayName}
                </option>
              ))}
            </Select>
          ) : null}
        </form>
      </Modal>
    </div>
  );
}
