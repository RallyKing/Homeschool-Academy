"use client";

import { FormEvent, Suspense, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import {
  Badge,
  Button,
  EmptyState,
  Input,
  Message,
  Modal,
  PageHeader,
  Section,
  Select,
  TabPanel,
  Tabs,
  Textarea,
} from "@/components/ui";
import { usePageTab } from "@/hooks/usePageTab";

const FAMILY_LIFE_TABS = ["chores", "rewards"] as const;

type Recurrence = "once" | "daily" | "weekly";

function FamilyLifeInner() {
  const family = useQuery(api.users.myFamily);
  const students = useQuery(api.students.listForMyFamily);
  const [tab, setTab] = usePageTab(FAMILY_LIFE_TABS, "chores");

  const chores = useQuery(
    api.chores.listForFamily,
    family ? { familyId: family._id } : "skip",
  );
  const rewards = useQuery(
    api.gamification.listRewards,
    family ? { familyId: family._id } : "skip",
  );
  const redemptions = useQuery(
    api.gamification.listRedemptions,
    family ? { familyId: family._id } : "skip",
  );

  const createChore = useMutation(api.chores.create);
  const updateChore = useMutation(api.chores.update);
  const removeChore = useMutation(api.chores.remove);
  const reopenChore = useMutation(api.chores.reopen);
  const createReward = useMutation(api.gamification.createReward);
  const updateReward = useMutation(api.gamification.updateReward);
  const removeReward = useMutation(api.gamification.removeReward);
  const fulfill = useMutation(api.gamification.fulfillRedemption);
  const cancelRedemption = useMutation(api.gamification.cancelRedemption);

  const [message, setMessage] = useState<string | null>(null);
  const [messageTone, setMessageTone] = useState<"info" | "error" | "success">(
    "info",
  );
  const [choreOpen, setChoreOpen] = useState(false);
  const [editChoreId, setEditChoreId] = useState<Id<"chores"> | null>(null);
  const [choreTitle, setChoreTitle] = useState("");
  const [choreDesc, setChoreDesc] = useState("");
  const [choreStudent, setChoreStudent] = useState("");
  const [choreDue, setChoreDue] = useState("");
  const [choreRecurrence, setChoreRecurrence] = useState<Recurrence>("once");
  const [choreXp, setChoreXp] = useState("15");
  const [chorePts, setChorePts] = useState("5");

  const [rewardOpen, setRewardOpen] = useState(false);
  const [editRewardId, setEditRewardId] = useState<Id<"rewardCatalog"> | null>(
    null,
  );
  const [rewardTitle, setRewardTitle] = useState("");
  const [rewardDesc, setRewardDesc] = useState("");
  const [rewardCost, setRewardCost] = useState("50");

  const [statusFilter, setStatusFilter] = useState<"all" | "todo" | "done">(
    "todo",
  );

  function notify(text: string, tone: "info" | "error" | "success" = "success") {
    setMessage(text);
    setMessageTone(tone);
  }

  function openCreateChore() {
    setEditChoreId(null);
    setChoreTitle("");
    setChoreDesc("");
    setChoreStudent(students?.[0]?._id ?? "");
    setChoreDue("");
    setChoreRecurrence("once");
    setChoreXp("15");
    setChorePts("5");
    setChoreOpen(true);
  }

  function openEditChore(row: {
    chore: {
      _id: Id<"chores">;
      title: string;
      description?: string;
      studentId: Id<"students">;
      dueDate?: string;
      recurrence: Recurrence;
      xpReward?: number;
      pointsReward?: number;
    };
  }) {
    const c = row.chore;
    setEditChoreId(c._id);
    setChoreTitle(c.title);
    setChoreDesc(c.description ?? "");
    setChoreStudent(c.studentId);
    setChoreDue(c.dueDate ?? "");
    setChoreRecurrence(c.recurrence);
    setChoreXp(String(c.xpReward ?? 15));
    setChorePts(String(c.pointsReward ?? 5));
    setChoreOpen(true);
  }

  async function onSaveChore(e: FormEvent) {
    e.preventDefault();
    if (!family || !choreStudent || !choreTitle.trim()) return;
    try {
      if (editChoreId) {
        await updateChore({
          choreId: editChoreId,
          title: choreTitle.trim(),
          description: choreDesc.trim() || undefined,
          studentId: choreStudent as Id<"students">,
          dueDate: choreDue || undefined,
          recurrence: choreRecurrence,
          xpReward: Number(choreXp) || undefined,
          pointsReward: Number(chorePts) || undefined,
        });
        notify("Chore updated.");
      } else {
        await createChore({
          familyId: family._id,
          studentId: choreStudent as Id<"students">,
          title: choreTitle.trim(),
          description: choreDesc.trim() || undefined,
          dueDate: choreDue || undefined,
          recurrence: choreRecurrence,
          xpReward: Number(choreXp) || undefined,
          pointsReward: Number(chorePts) || undefined,
        });
        notify("Chore assigned.");
      }
      setChoreOpen(false);
    } catch (err) {
      notify(err instanceof Error ? err.message : "Failed", "error");
    }
  }

  function openCreateReward() {
    setEditRewardId(null);
    setRewardTitle("");
    setRewardDesc("");
    setRewardCost("50");
    setRewardOpen(true);
  }

  function openEditReward(r: {
    _id: Id<"rewardCatalog">;
    title: string;
    description?: string;
    costPoints: number;
  }) {
    setEditRewardId(r._id);
    setRewardTitle(r.title);
    setRewardDesc(r.description ?? "");
    setRewardCost(String(r.costPoints));
    setRewardOpen(true);
  }

  async function onSaveReward(e: FormEvent) {
    e.preventDefault();
    if (!family || !rewardTitle.trim()) return;
    try {
      if (editRewardId) {
        await updateReward({
          rewardId: editRewardId,
          title: rewardTitle.trim(),
          description: rewardDesc.trim() || undefined,
          costPoints: Number(rewardCost) || 1,
        });
        notify("Reward updated.");
      } else {
        await createReward({
          familyId: family._id,
          title: rewardTitle.trim(),
          description: rewardDesc.trim() || undefined,
          costPoints: Number(rewardCost) || 1,
        });
        notify("Reward added to shop.");
      }
      setRewardOpen(false);
    } catch (err) {
      notify(err instanceof Error ? err.message : "Failed", "error");
    }
  }

  if (family === undefined) {
    return <p className="text-sm text-[var(--muted)]">Loading…</p>;
  }

  if (!family) {
    return (
      <div className="page-stack">
        <PageHeader
          compact
          eyebrow="Life"
          title="Chores & rewards"
          description="Create a family first to assign chores and shop rewards."
        />
        <Link href="/family/dashboard">
          <Button>Go to family home</Button>
        </Link>
      </div>
    );
  }

  const filtered =
    chores?.filter((row) =>
      statusFilter === "all" ? true : row.chore.status === statusFilter,
    ) ?? [];

  const openCount = chores?.filter((r) => r.chore.status === "todo").length ?? 0;
  const pendingRedemptions =
    redemptions?.filter((r) => r.redemption.status === "pending").length ?? 0;

  return (
    <div className="page-stack">
      <PageHeader
        compact
        eyebrow="Life"
        title="Chores & rewards"
        description="Assign household tasks and stock the points shop."
        actions={
          tab === "chores" ? (
            <Button size="sm" onClick={openCreateChore}>
              Assign chore
            </Button>
          ) : (
            <Button size="sm" onClick={openCreateReward}>
              Add reward
            </Button>
          )
        }
      />

      <Message tone={messageTone}>{message}</Message>

      <Tabs
        tabs={[
          { id: "chores", label: "Chores", count: openCount },
          { id: "rewards", label: "Rewards", count: pendingRedemptions },
        ]}
        value={tab}
        onChange={setTab}
      />

      <TabPanel id="chores" active={tab === "chores"}>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[10rem]">
            <Select
              label="Status"
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as "all" | "todo" | "done")
              }
            >
              <option value="todo">Open</option>
              <option value="done">Done</option>
              <option value="all">All</option>
            </Select>
          </div>
        </div>

        {chores === undefined ? (
          <p className="text-sm text-[var(--muted)]">Loading…</p>
        ) : filtered.length === 0 ? (
          <EmptyState>No chores in this filter — assign one to start.</EmptyState>
        ) : (
          <ul className="space-y-1.5">
            {filtered.map((row) => (
              <li key={row.chore._id} className="list-row list-row-dense">
                <div className="min-w-0">
                  <p className="font-medium">{row.chore.title}</p>
                  <p className="text-xs text-[var(--muted)]">
                    {row.studentName}
                    {row.chore.dueDate ? ` · due ${row.chore.dueDate}` : ""}
                    {` · ${row.chore.recurrence}`}
                    {row.chore.xpReward
                      ? ` · +${row.chore.xpReward} XP`
                      : ""}
                  </p>
                </div>
                <span className="flex flex-wrap items-center gap-1.5">
                  <Badge
                    tone={
                      row.chore.status === "done"
                        ? "success"
                        : row.chore.status === "skipped"
                          ? "neutral"
                          : "warning"
                    }
                  >
                    {row.chore.status}
                  </Badge>
                  {row.chore.status === "done" ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        void reopenChore({ choreId: row.chore._id })
                          .then(() => notify("Chore reopened."))
                          .catch((err) =>
                            notify(
                              err instanceof Error ? err.message : "Failed",
                              "error",
                            ),
                          )
                      }
                    >
                      Reopen
                    </Button>
                  ) : null}
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => openEditChore(row)}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => {
                      if (!window.confirm(`Delete “${row.chore.title}”?`)) return;
                      void removeChore({ choreId: row.chore._id })
                        .then(() => notify("Chore deleted."))
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
              </li>
            ))}
          </ul>
        )}
      </TabPanel>

      <TabPanel id="rewards" active={tab === "rewards"}>
        <Section title="Shop catalog" description="Students spend points here.">
          {rewards === undefined ? (
            <p className="text-sm text-[var(--muted)]">Loading…</p>
          ) : rewards.length === 0 ? (
            <EmptyState>No rewards yet — add one for the shop.</EmptyState>
          ) : (
            <ul className="space-y-1.5">
              {rewards.map((r) => (
                <li key={r._id} className="list-row list-row-dense">
                  <div>
                    <p className="font-medium">
                      {r.title}
                      {!r.active ? (
                        <Badge tone="neutral" className="ml-2">
                          inactive
                        </Badge>
                      ) : null}
                    </p>
                    <p className="text-xs text-[var(--muted)]">
                      {r.costPoints} points
                      {r.description ? ` · ${r.description}` : ""}
                    </p>
                  </div>
                  <span className="flex flex-wrap gap-1.5">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        void updateReward({
                          rewardId: r._id,
                          active: !r.active,
                        })
                          .then(() =>
                            notify(r.active ? "Hidden from shop." : "Activated."),
                          )
                          .catch((err) =>
                            notify(
                              err instanceof Error ? err.message : "Failed",
                              "error",
                            ),
                          )
                      }
                    >
                      {r.active ? "Hide" : "Show"}
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => openEditReward(r)}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => {
                        if (!window.confirm(`Delete “${r.title}”?`)) return;
                        void removeReward({ rewardId: r._id })
                          .then(() => notify("Reward deleted."))
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
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Redemptions" description="Fulfill or cancel student spends.">
          {!redemptions || redemptions.length === 0 ? (
            <EmptyState>No redemptions yet.</EmptyState>
          ) : (
            <ul className="space-y-1.5">
              {redemptions.slice(0, 20).map(({ redemption: r, rewardTitle, studentName }) => (
                <li key={r._id} className="list-row list-row-dense">
                  <div>
                    <p className="font-medium">
                      {rewardTitle} · {studentName}
                    </p>
                    <p className="text-xs text-[var(--muted)]">
                      {r.costPoints} pts · {r.status}
                    </p>
                  </div>
                  {r.status === "pending" ? (
                    <span className="flex gap-1.5">
                      <Button
                        size="sm"
                        onClick={() =>
                          void fulfill({ redemptionId: r._id })
                            .then(() => notify("Fulfilled."))
                            .catch((err) =>
                              notify(
                                err instanceof Error ? err.message : "Failed",
                                "error",
                              ),
                            )
                        }
                      >
                        Fulfill
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          void cancelRedemption({ redemptionId: r._id })
                            .then(() => notify("Cancelled — points returned."))
                            .catch((err) =>
                              notify(
                                err instanceof Error ? err.message : "Failed",
                                "error",
                              ),
                            )
                        }
                      >
                        Cancel
                      </Button>
                    </span>
                  ) : (
                    <Badge tone="neutral">{r.status}</Badge>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Section>
      </TabPanel>

      <Modal
        open={choreOpen}
        onClose={() => setChoreOpen(false)}
        title={editChoreId ? "Edit chore" : "Assign chore"}
        footer={
          <>
            <Button variant="ghost" onClick={() => setChoreOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="chore-form">
              {editChoreId ? "Save" : "Assign"}
            </Button>
          </>
        }
      >
        <form id="chore-form" onSubmit={(e) => void onSaveChore(e)} className="space-y-4">
          <Select
            label="Student"
            value={choreStudent}
            onChange={(e) => setChoreStudent(e.target.value)}
            required
          >
            {(students ?? []).map((s) => (
              <option key={s._id} value={s._id}>
                {s.displayName}
              </option>
            ))}
          </Select>
          <Input
            label="Title"
            value={choreTitle}
            onChange={(e) => setChoreTitle(e.target.value)}
            required
          />
          <Textarea
            label="Notes"
            rows={2}
            value={choreDesc}
            onChange={(e) => setChoreDesc(e.target.value)}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label="Due date"
              type="date"
              value={choreDue}
              onChange={(e) => setChoreDue(e.target.value)}
            />
            <Select
              label="Recurrence"
              value={choreRecurrence}
              onChange={(e) =>
                setChoreRecurrence(e.target.value as Recurrence)
              }
            >
              <option value="once">Once</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
            </Select>
            <Input
              label="XP reward"
              type="number"
              min={0}
              value={choreXp}
              onChange={(e) => setChoreXp(e.target.value)}
            />
            <Input
              label="Points reward"
              type="number"
              min={0}
              value={chorePts}
              onChange={(e) => setChorePts(e.target.value)}
            />
          </div>
        </form>
      </Modal>

      <Modal
        open={rewardOpen}
        onClose={() => setRewardOpen(false)}
        title={editRewardId ? "Edit reward" : "Add reward"}
        footer={
          <>
            <Button variant="ghost" onClick={() => setRewardOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="reward-form">
              {editRewardId ? "Save" : "Add"}
            </Button>
          </>
        }
      >
        <form
          id="reward-form"
          onSubmit={(e) => void onSaveReward(e)}
          className="space-y-4"
        >
          <Input
            label="Title"
            value={rewardTitle}
            onChange={(e) => setRewardTitle(e.target.value)}
            required
          />
          <Textarea
            label="Description"
            rows={2}
            value={rewardDesc}
            onChange={(e) => setRewardDesc(e.target.value)}
          />
          <Input
            label="Cost (points)"
            type="number"
            min={1}
            value={rewardCost}
            onChange={(e) => setRewardCost(e.target.value)}
            required
          />
        </form>
      </Modal>
    </div>
  );
}

export default function FamilyChoresPage() {
  return (
    <Suspense fallback={<p className="text-sm text-[var(--muted)]">Loading…</p>}>
      <FamilyLifeInner />
    </Suspense>
  );
}
