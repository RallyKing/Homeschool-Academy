"use client";

import { FormEvent, Suspense, useState } from "react";
import Link from "next/link";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import {
  Badge,
  Button,
  EmptyState,
  Message,
  PageHeader,
  Section,
  Select,
  TabPanel,
  Tabs,
  Textarea,
} from "@/components/ui";
import { usePageTab } from "@/hooks/usePageTab";
import { CourseAssistPanel } from "@/components/CourseAssistPanel";

const AI_TABS = [
  "guardrails",
  "badges",
  "course",
  "insights",
] as const;

function FamilyAiInner() {
  const user = useQuery(api.users.current);
  const family = useQuery(api.users.myFamily);
  const students = useQuery(api.students.listForMyFamily);
  const courses = useQuery(
    api.courses.listForFamily,
    family ? { familyId: family._id } : "skip",
  );
  const capabilities = useQuery(api.ai.capabilities.listCapabilities);
  const proposals = useQuery(
    api.ai.badgeProposals.listProposals,
    family ? { familyId: family._id, status: "pending" } : "skip",
  );

  const [tab, setTab] = usePageTab(AI_TABS, "guardrails");

  const filterPrompt = useAction(api.ai.filterPrompt);
  const craftBadges = useAction(api.ai.badgeCraft.craft);
  const optimizeFamily = useAction(api.ai.familyOptimize.analyze);
  const personalizeChild = useAction(api.ai.childPersonalize.personalize);
  const acceptProposal = useMutation(api.ai.badgeProposals.accept);
  const rejectProposal = useMutation(api.ai.badgeProposals.reject);
  const removeProposal = useMutation(api.ai.badgeProposals.remove);
  const updateProposal = useMutation(api.ai.badgeProposals.update);
  const updateFamily = useMutation(api.families.update);

  const [parentGuardrailDraft, setParentGuardrailDraft] = useState<
    string | null
  >(null);
  const parentGuardrailContext =
    parentGuardrailDraft ??
    family?.parentGuardrailContext ??
    "Focus on STEM and reading. Age-appropriate only. block: dating, weapons";
  const [studentPrompt, setStudentPrompt] = useState(
    "Can you help me understand fractions?",
  );
  const [guardResult, setGuardResult] = useState<{
    allowed: boolean;
    response: string;
    filteredTopics: string[];
    reason: string;
    provider: string;
  } | null>(null);

  const [studentId, setStudentId] = useState("");
  const [courseId, setCourseId] = useState("");
  const [craftReason, setCraftReason] = useState<string | null>(null);
  const [insightsSummary, setInsightsSummary] = useState<string | null>(null);
  const [insights, setInsights] = useState<
    Array<{
      area: string;
      title: string;
      detail: string;
      priority: string;
    }>
  >([]);
  const [childTips, setChildTips] = useState<
    Array<{
      area: string;
      title: string;
      detail: string;
      priority: string;
    }>
  >([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editId, setEditId] = useState<Id<"badgeProposals"> | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");

  async function saveGuardrailsToFamily() {
    if (!family) return;
    setBusy(true);
    setError(null);
    try {
      await updateFamily({
        familyId: family._id,
        parentGuardrailContext,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setBusy(false);
    }
  }

  async function onGuardrails(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setGuardResult(null);
    try {
      const res = await filterPrompt({
        studentPrompt: studentPrompt.trim(),
        parentGuardrailContext: parentGuardrailContext.trim(),
      });
      setGuardResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function onCraft() {
    if (!studentId) {
      setError("Pick a student first");
      return;
    }
    setBusy(true);
    setError(null);
    setCraftReason(null);
    try {
      const res = await craftBadges({
        studentId: studentId as Id<"students">,
        parentGuardrailContext: parentGuardrailContext.trim(),
        persist: true,
      });
      setCraftReason(`${res.reason} · age band: ${res.ageBand} · ${res.provider}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function onFamilyInsights() {
    if (!family) return;
    setBusy(true);
    setError(null);
    try {
      const res = await optimizeFamily({
        familyId: family._id,
        parentGuardrailContext: parentGuardrailContext.trim(),
      });
      setInsightsSummary(res.summary);
      setInsights(res.recommendations);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function onChildTips() {
    if (!studentId) {
      setError("Pick a student first");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await personalizeChild({
        studentId: studentId as Id<"students">,
        parentGuardrailContext: parentGuardrailContext.trim(),
      });
      setChildTips(res.recommendations);
      setInsightsSummary(
        `${res.studentName} · ${res.ageBand} · ${res.provider}`,
      );
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
        title="Family AI"
        description="Narrow capabilities — guardrails, badge craft, course help, learning insights, and read-along stories. Mock today; flip on OPENAI_API_KEY or AI_GATEWAY_API_KEY later."
      />

      {capabilities && capabilities.length > 0 ? (
        <p className="text-xs text-[var(--muted)]">
          Registry: {capabilities.map((c) => c.id).join(" · ")} ·{" "}
          <Link href="/family/read-along" className="text-[var(--accent)]">
            Open read-along
          </Link>
        </p>
      ) : null}

      <Tabs
        tabs={[
          { id: "guardrails", label: "Guardrails" },
          {
            id: "badges",
            label: "Badge craft",
            count: proposals?.length,
          },
          { id: "course", label: "Course assist" },
          { id: "insights", label: "Family insights" },
        ]}
        value={tab}
        onChange={setTab}
      />

      <Message tone="error">{error}</Message>

      <TabPanel id="guardrails" active={tab === "guardrails"}>
        <Section title="Parent guardrails">
          <form onSubmit={(e) => void onGuardrails(e)} className="space-y-4">
            <Textarea
              label="Parent guardrail context"
              rows={3}
              value={parentGuardrailContext}
              onChange={(e) => setParentGuardrailDraft(e.target.value)}
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
            <Button
              type="button"
              variant="secondary"
              disabled={busy || !family}
              onClick={() => void saveGuardrailsToFamily()}
            >
              Save to family settings
            </Button>
            <Link href="/family/settings?tab=ai">
              <Button type="button" variant="ghost" size="sm">
                Open settings
              </Button>
            </Link>
          </form>
        </Section>

        {guardResult ? (
          <Section title="Result">
            <div className="space-y-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={guardResult.allowed ? "success" : "danger"}>
                  {guardResult.allowed ? "Allowed" : "Blocked"}
                </Badge>
                <span className="text-sm text-[var(--muted)]">
                  provider: {guardResult.provider}
                </span>
              </div>
              <p className="text-sm text-[var(--muted)]">{guardResult.reason}</p>
              {guardResult.filteredTopics.length > 0 ? (
                <p className="text-sm">
                  Filtered: {guardResult.filteredTopics.join(", ")}
                </p>
              ) : null}
              <pre className="whitespace-pre-wrap text-sm text-[var(--foreground)]">
                {guardResult.response}
              </pre>
            </div>
          </Section>
        ) : null}
      </TabPanel>

      <TabPanel id="badges" active={tab === "badges"}>
        <Section title="Craft age-appropriate badges">
          <div className="space-y-4">
            <Select
              label="Student"
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
            >
              <option value="">Select student…</option>
              {students?.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.displayName}
                </option>
              ))}
            </Select>
            <Textarea
              label="Guardrails for badge tone"
              rows={2}
              value={parentGuardrailContext}
              onChange={(e) => setParentGuardrailDraft(e.target.value)}
            />
            <Button type="button" disabled={busy || !studentId} onClick={() => void onCraft()}>
              {busy ? "Crafting…" : "Propose badges"}
            </Button>
            {craftReason ? (
              <p className="text-sm text-[var(--muted)]">{craftReason}</p>
            ) : null}
            <p className="text-xs text-[var(--muted)]">
              Proposals stay pending until you accept. Students only see earned
              badges — generation is parent-gated for safety.
            </p>
          </div>
        </Section>

        <Section title="Pending proposals">
          {!proposals || proposals.length === 0 ? (
            <EmptyState>No pending badge proposals.</EmptyState>
          ) : (
            <ul className="space-y-3">
              {proposals.map((p) => (
                <li
                  key={p._id}
                  className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-4"
                >
                  {editId === p._id ? (
                    <div className="space-y-3">
                      <Textarea
                        label="Title"
                        rows={1}
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                      />
                      <Textarea
                        label="Description"
                        rows={2}
                        value={editDesc}
                        onChange={(e) => setEditDesc(e.target.value)}
                      />
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          onClick={() => {
                            void (async () => {
                              try {
                                await updateProposal({
                                  proposalId: p._id,
                                  title: editTitle,
                                  description: editDesc,
                                });
                                setEditId(null);
                              } catch (err) {
                                setError(
                                  err instanceof Error ? err.message : "Failed",
                                );
                              }
                            })();
                          }}
                        >
                          Save
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditId(null)}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="font-medium">{p.title}</p>
                          <p className="mt-1 text-sm text-[var(--muted)]">
                            {p.description}
                          </p>
                          <p className="mt-2 text-xs text-[var(--muted)]">
                            {p.criteriaSummary} · {p.ageBand} · icon:{p.iconHint}
                          </p>
                        </div>
                        <Badge tone="warning">pending</Badge>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          onClick={() => {
                            void (async () => {
                              try {
                                await acceptProposal({
                                  proposalId: p._id,
                                  grantToStudent: true,
                                });
                              } catch (err) {
                                setError(
                                  err instanceof Error ? err.message : "Failed",
                                );
                              }
                            })();
                          }}
                        >
                          Accept & grant
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            setEditId(p._id);
                            setEditTitle(p.title);
                            setEditDesc(p.description);
                          }}
                        >
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            void (async () => {
                              try {
                                await rejectProposal({ proposalId: p._id });
                              } catch (err) {
                                setError(
                                  err instanceof Error ? err.message : "Failed",
                                );
                              }
                            })();
                          }}
                        >
                          Reject
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            if (
                              !confirm("Delete this proposal permanently?")
                            ) {
                              return;
                            }
                            void (async () => {
                              try {
                                await removeProposal({ proposalId: p._id });
                              } catch (err) {
                                setError(
                                  err instanceof Error ? err.message : "Failed",
                                );
                              }
                            })();
                          }}
                        >
                          Delete
                        </Button>
                      </div>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Section>
      </TabPanel>

      <TabPanel id="course" active={tab === "course"}>
        <Section title="Course assistant">
          <div className="mb-4 grid gap-3 sm:grid-cols-2">
            <Select
              label="Student"
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
            >
              <option value="">Select student…</option>
              {students?.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.displayName}
                </option>
              ))}
            </Select>
            <Select
              label="Course"
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
            >
              <option value="">Select course…</option>
              {courses?.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.title}
                </option>
              ))}
            </Select>
          </div>
          {studentId && courseId ? (
            <CourseAssistPanel
              studentId={studentId as Id<"students">}
              courseId={courseId as Id<"courses">}
              parentGuardrailContext={parentGuardrailContext}
            />
          ) : (
            <EmptyState>
              Choose a student and course to ask a focused question.
            </EmptyState>
          )}
        </Section>
      </TabPanel>

      <TabPanel id="insights" active={tab === "insights"}>
        <Section title="Family optimize">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              disabled={busy || !family}
              onClick={() => void onFamilyInsights()}
            >
              {busy ? "Analyzing…" : "Analyze family plan"}
            </Button>
          </div>
        </Section>

        <Section title="Per-child personalize">
          <div className="space-y-3">
            <Select
              label="Student"
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
            >
              <option value="">Select student…</option>
              {students?.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.displayName}
                </option>
              ))}
            </Select>
            <Button
              type="button"
              disabled={busy || !studentId}
              onClick={() => void onChildTips()}
            >
              {busy ? "Personalizing…" : "Personalize for child"}
            </Button>
          </div>
        </Section>

        {insightsSummary ? (
          <p className="text-sm text-[var(--muted)]">{insightsSummary}</p>
        ) : null}

        {(insights.length > 0 || childTips.length > 0) && (
          <Section title="Recommendations">
            <ul className="space-y-3">
              {[...insights, ...childTips].map((r, i) => (
                <li
                  key={`${r.title}-${i}`}
                  className="border-b border-[var(--border)] pb-3 last:border-0"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{r.title}</p>
                    <Badge tone="neutral">{r.area}</Badge>
                    <Badge
                      tone={
                        r.priority === "high"
                          ? "danger"
                          : r.priority === "medium"
                            ? "warning"
                            : "neutral"
                      }
                    >
                      {r.priority}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-[var(--muted)]">{r.detail}</p>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-[var(--muted)]">
              Tips are educational pacing suggestions — not medical advice, and
              never competitive rankings.
            </p>
          </Section>
        )}
      </TabPanel>
    </div>
  );
}

export default function FamilyAiPage() {
  return (
    <Suspense fallback={<p className="text-sm text-[var(--muted)]">Loading…</p>}>
      <FamilyAiInner />
    </Suspense>
  );
}
