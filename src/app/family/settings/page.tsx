"use client";

import { FormEvent, Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useRouter } from "next/navigation";
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

const FAMILY_SETTINGS_TABS = [
  "household",
  "students",
  "subjects",
  "academies",
  "rewards",
  "notifications",
  "privacy",
  "ai",
  "account",
] as const;

type SubjectCategory = "stem" | "humanities" | "life" | "applied";
type MemberRole = "parent" | "guardian";

function PrefToggle({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}) {
  return (
    <label
      className={`list-row list-row-dense ${disabled ? "opacity-60" : "cursor-pointer"}`}
    >
      <div className="min-w-0">
        <p className="font-medium text-[var(--foreground)]">{label}</p>
        {description ? (
          <p className="text-xs text-[var(--muted)]">{description}</p>
        ) : null}
      </div>
      <input
        type="checkbox"
        className="h-4 w-4 accent-[var(--accent)]"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
}

function FamilySettingsInner() {
  const router = useRouter();
  const { signOut } = useAuthActions();
  const [tab, setTab] = usePageTab(FAMILY_SETTINGS_TABS, "household");

  const user = useQuery(api.users.current);
  const status = useQuery(api.users.onboardingStatus);
  const family = useQuery(api.users.myFamily);
  const students = useQuery(api.students.listForMyFamily);
  const members = useQuery(
    api.families.listMembers,
    family ? { familyId: family._id } : "skip",
  );
  const subjects = useQuery(
    api.subjects.listForSettings,
    family ? { familyId: family._id } : "skip",
  );
  const academies = useQuery(api.academies.listBrowsable);
  const subscriptions = useQuery(api.academies.mySubscriptions);
  const rewards = useQuery(
    api.gamification.listRewards,
    family ? { familyId: family._id } : "skip",
  );
  const prefs = useQuery(api.settings.getMine);

  const updateFamily = useMutation(api.families.update);
  const removeFamily = useMutation(api.families.remove);
  const addMemberByEmail = useMutation(api.families.addMemberByEmail);
  const removeMember = useMutation(api.families.removeMember);
  const createStudent = useMutation(api.students.create);
  const removeStudent = useMutation(api.students.remove);
  const createSubject = useMutation(api.subjects.create);
  const updateSubject = useMutation(api.subjects.update);
  const removeSubject = useMutation(api.subjects.remove);
  const setHiddenForFamily = useMutation(api.subjects.setHiddenForFamily);
  const cloneForFamily = useMutation(api.subjects.cloneForFamily);
  const seedSubjects = useMutation(api.subjects.seed);
  const subscribe = useMutation(api.academies.subscribeFamily);
  const unsubscribe = useMutation(api.academies.unsubscribeFamily);
  const createReward = useMutation(api.gamification.createReward);
  const updateReward = useMutation(api.gamification.updateReward);
  const removeReward = useMutation(api.gamification.removeReward);
  const updatePrefs = useMutation(api.settings.updateMine);

  const [message, setMessage] = useState<string | null>(null);
  const [messageTone, setMessageTone] = useState<"info" | "error" | "success">(
    "info",
  );

  const [familyNameDraft, setFamilyNameDraft] = useState<string | null>(null);
  const [memberEmail, setMemberEmail] = useState("");
  const [memberRole, setMemberRole] = useState<MemberRole>("parent");
  const [studentName, setStudentName] = useState("");
  const [studentLevel, setStudentLevel] = useState("");
  const [guardrailDraft, setGuardrailDraft] = useState<string | null>(null);

  const [subjectOpen, setSubjectOpen] = useState(false);
  const [editSubjectId, setEditSubjectId] = useState<Id<"subjects"> | null>(
    null,
  );
  const [subjectName, setSubjectName] = useState("");
  const [subjectCategory, setSubjectCategory] =
    useState<SubjectCategory>("stem");

  const [rewardOpen, setRewardOpen] = useState(false);
  const [editRewardId, setEditRewardId] = useState<Id<"rewardCatalog"> | null>(
    null,
  );
  const [rewardTitle, setRewardTitle] = useState("");
  const [rewardDesc, setRewardDesc] = useState("");
  const [rewardCost, setRewardCost] = useState("50");

  const subscribedIds = new Set(
    subscriptions?.map((s) => s.academy._id) ?? [],
  );

  useEffect(() => {
    if (status?.needsOnboarding) {
      router.replace("/onboarding");
    }
  }, [status, router]);

  const familyName = familyNameDraft ?? family?.name ?? "";
  const guardrail =
    guardrailDraft ??
    family?.parentGuardrailContext ??
    "Focus on STEM and reading. Age-appropriate only. block: dating, weapons";

  function notify(text: string, tone: "info" | "error" | "success" = "success") {
    setMessage(text);
    setMessageTone(tone);
  }

  if (user === undefined || family === undefined) {
    return <p className="text-sm text-[var(--muted)]">Loading…</p>;
  }

  if (!user) {
    return <p className="text-sm text-[var(--muted)]">Please sign in.</p>;
  }

  if (!family) {
    return (
      <div className="page-stack">
        <PageHeader
          compact
          eyebrow="Family"
          title="Settings"
          description="Create a family before managing household settings."
        />
        <Link href="/onboarding">
          <Button>Set up family</Button>
        </Link>
      </div>
    );
  }

  const fam = family;

  async function onRenameFamily(e: FormEvent) {
    e.preventDefault();
    const next = familyName.trim();
    if (!next) return;
    try {
      await updateFamily({ familyId: fam._id, name: next });
      notify("Family name updated.");
    } catch (err) {
      notify(err instanceof Error ? err.message : "Failed", "error");
    }
  }

  async function onAddMember(e: FormEvent) {
    e.preventDefault();
    if (!memberEmail.trim()) return;
    try {
      await addMemberByEmail({
        familyId: fam._id,
        email: memberEmail.trim(),
        role: memberRole,
      });
      setMemberEmail("");
      notify("Member added.");
    } catch (err) {
      notify(err instanceof Error ? err.message : "Failed", "error");
    }
  }

  async function onAddStudent(e: FormEvent) {
    e.preventDefault();
    if (!studentName.trim()) return;
    try {
      await createStudent({
        familyId: fam._id,
        displayName: studentName.trim(),
        academicLevel: studentLevel.trim() || undefined,
      });
      setStudentName("");
      setStudentLevel("");
      notify("Student added.");
    } catch (err) {
      notify(err instanceof Error ? err.message : "Failed", "error");
    }
  }

  function openCreateSubject() {
    setEditSubjectId(null);
    setSubjectName("");
    setSubjectCategory("stem");
    setSubjectOpen(true);
  }

  function openEditSubject(row: {
    subject: {
      _id: Id<"subjects">;
      name: string;
      category: SubjectCategory;
    };
  }) {
    setEditSubjectId(row.subject._id);
    setSubjectName(row.subject.name);
    setSubjectCategory(row.subject.category);
    setSubjectOpen(true);
  }

  async function onSaveSubject(e: FormEvent) {
    e.preventDefault();
    if (!subjectName.trim()) return;
    try {
      if (editSubjectId) {
        await updateSubject({
          subjectId: editSubjectId,
          name: subjectName.trim(),
          category: subjectCategory,
        });
        notify("Subject updated.");
      } else {
        await createSubject({
          familyId: fam._id,
          name: subjectName.trim(),
          category: subjectCategory,
        });
        notify("Custom subject created.");
      }
      setSubjectOpen(false);
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
    const cost = Number(rewardCost);
    if (!rewardTitle.trim() || !(cost > 0)) {
      notify("Title and a cost greater than 0 are required.", "error");
      return;
    }
    try {
      if (editRewardId) {
        await updateReward({
          rewardId: editRewardId,
          title: rewardTitle.trim(),
          description: rewardDesc.trim() || undefined,
          costPoints: cost,
        });
        notify("Reward updated.");
      } else {
        await createReward({
          familyId: fam._id,
          title: rewardTitle.trim(),
          description: rewardDesc.trim() || undefined,
          costPoints: cost,
        });
        notify("Reward added.");
      }
      setRewardOpen(false);
    } catch (err) {
      notify(err instanceof Error ? err.message : "Failed", "error");
    }
  }

  async function onSaveGuardrail(e: FormEvent) {
    e.preventDefault();
    try {
      await updateFamily({
        familyId: fam._id,
        parentGuardrailContext: guardrail.trim(),
      });
      notify("AI guardrails saved.");
    } catch (err) {
      notify(err instanceof Error ? err.message : "Failed", "error");
    }
  }

  return (
    <div className="page-stack">
      <PageHeader
        compact
        eyebrow="Family"
        title="Settings"
        description="Household, subjects, rewards, privacy, and account controls."
      />

      <Message tone={messageTone}>{message}</Message>

      <Tabs
        size="sm"
        tabs={[
          { id: "household", label: "Household" },
          {
            id: "students",
            label: "Students",
            count: students?.length,
          },
          {
            id: "subjects",
            label: "Subjects",
            count: subjects?.length,
          },
          { id: "academies", label: "Academies" },
          { id: "rewards", label: "Rewards" },
          { id: "notifications", label: "Notifications" },
          { id: "privacy", label: "Privacy" },
          { id: "ai", label: "AI" },
          { id: "account", label: "Account" },
        ]}
        value={tab}
        onChange={setTab}
      />

      <TabPanel id="household" active={tab === "household"}>
        <Section title="Family name" description="Shown across dashboards and reports.">
          <form
            onSubmit={(e) => void onRenameFamily(e)}
            className="flex flex-wrap items-end gap-2"
          >
            <div className="min-w-[12rem] flex-1">
              <Input
                label="Name"
                value={familyName}
                onChange={(e) => setFamilyNameDraft(e.target.value)}
                required
              />
            </div>
            <Button type="submit" variant="secondary" size="sm">
              Save
            </Button>
          </form>
        </Section>

        <Section
          title="Members"
          description="Parents and guardians who can manage this household."
        >
          {members === undefined ? (
            <p className="text-sm text-[var(--muted)]">Loading…</p>
          ) : members.length === 0 ? (
            <EmptyState>No members yet.</EmptyState>
          ) : (
            <ul className="space-y-1.5">
              {members.map(({ membership, email, name }) => (
                <li key={membership._id} className="list-row list-row-dense">
                  <div className="min-w-0">
                    <p className="font-medium">
                      {name ?? email ?? membership.userId}
                      <Badge tone="neutral" className="ml-2">
                        {membership.role}
                      </Badge>
                    </p>
                    {email ? (
                      <p className="text-xs text-[var(--muted)]">{email}</p>
                    ) : null}
                  </div>
                  {membership.userId !== family.createdBy ? (
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => {
                        if (!window.confirm("Remove this family member?"))
                          return;
                        void removeMember({
                          familyId: family._id,
                          userId: membership.userId,
                        })
                          .then(() => notify("Member removed."))
                          .catch((err) =>
                            notify(
                              err instanceof Error ? err.message : "Failed",
                              "error",
                            ),
                          );
                      }}
                    >
                      Remove
                    </Button>
                  ) : (
                    <Badge tone="success">Owner</Badge>
                  )}
                </li>
              ))}
            </ul>
          )}

          <form
            onSubmit={(e) => void onAddMember(e)}
            className="mt-4 flex flex-wrap items-end gap-2"
          >
            <div className="min-w-[12rem] flex-1">
              <Input
                type="email"
                label="Add by email"
                placeholder="parent@email.com"
                value={memberEmail}
                onChange={(e) => setMemberEmail(e.target.value)}
                required
              />
            </div>
            <Select
              label="Role"
              value={memberRole}
              onChange={(e) => setMemberRole(e.target.value as MemberRole)}
            >
              <option value="parent">Parent</option>
              <option value="guardian">Guardian</option>
            </Select>
            <Button type="submit" size="sm">
              Add
            </Button>
          </form>
        </Section>

        <Section title="Danger zone" description="Permanently delete this family.">
          <div className="list-row list-row-dense border-[var(--danger)]/25">
            <p className="text-sm text-[var(--muted)]">
              Deletes students, logs, schedules, and family courses. Cannot be
              undone.
            </p>
            <Button
              variant="danger"
              size="sm"
              onClick={() => {
                if (
                  !window.confirm(
                    "Delete this family and all related data? This cannot be undone.",
                  )
                ) {
                  return;
                }
                void removeFamily({ familyId: family._id })
                  .then(() => {
                    notify("Family deleted.");
                    router.replace("/onboarding");
                  })
                  .catch((err) =>
                    notify(
                      err instanceof Error ? err.message : "Failed",
                      "error",
                    ),
                  );
              }}
            >
              Delete family
            </Button>
          </div>
        </Section>
      </TabPanel>

      <TabPanel id="students" active={tab === "students"}>
        <Section
          title="Students"
          description="Open a student control center, or add a new learner."
        >
          {students === undefined ? (
            <p className="text-sm text-[var(--muted)]">Loading…</p>
          ) : students.length === 0 ? (
            <EmptyState>No students yet — add one below.</EmptyState>
          ) : (
            <ul className="space-y-1.5">
              {students.map((s) => (
                <li key={s._id} className="list-row list-row-dense">
                  <div className="min-w-0">
                    <p className="font-medium">{s.displayName}</p>
                    <p className="text-xs text-[var(--muted)]">
                      {s.academicLevel ?? "Student"}
                      {s.userId ? " · linked" : ""}
                    </p>
                  </div>
                  <span className="flex flex-wrap gap-1.5">
                    <Link href={`/family/students/${s._id}`}>
                      <Button variant="secondary" size="sm">
                        Open
                      </Button>
                    </Link>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => {
                        if (
                          !window.confirm(
                            `Delete ${s.displayName} and all their logs/schedules?`,
                          )
                        ) {
                          return;
                        }
                        void removeStudent({ studentId: s._id })
                          .then(() => notify("Student deleted."))
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

          <form
            onSubmit={(e) => void onAddStudent(e)}
            className="mt-4 flex flex-wrap items-end gap-2"
          >
            <div className="min-w-[10rem] flex-1">
              <Input
                label="Display name"
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                required
              />
            </div>
            <div className="min-w-[8rem] flex-1">
              <Input
                label="Level (optional)"
                value={studentLevel}
                onChange={(e) => setStudentLevel(e.target.value)}
                placeholder="Grade 5"
              />
            </div>
            <Button type="submit" size="sm">
              Add student
            </Button>
          </form>
        </Section>
      </TabPanel>

      <TabPanel id="subjects" active={tab === "subjects"}>
        <Section
          title="Subjects"
          description="Platform subjects can be hidden or cloned. Custom subjects are fully editable."
          action={
            <span className="flex flex-wrap gap-1.5">
              <Button
                variant="secondary"
                size="sm"
                onClick={() =>
                  void seedSubjects({})
                    .then((r) =>
                      notify(`Seeded ${r.created}/${r.total} subjects.`),
                    )
                    .catch((err) =>
                      notify(
                        err instanceof Error ? err.message : "Failed",
                        "error",
                      ),
                    )
                }
              >
                Seed platform
              </Button>
              <Button size="sm" onClick={openCreateSubject}>
                Add custom
              </Button>
            </span>
          }
        >
          {subjects === undefined ? (
            <p className="text-sm text-[var(--muted)]">Loading…</p>
          ) : subjects.length === 0 ? (
            <EmptyState>
              No subjects yet — seed the platform taxonomy or add a custom one.
            </EmptyState>
          ) : (
            <ul className="space-y-1.5">
              {subjects.map((row) => (
                <li
                  key={row.subject._id}
                  className={`list-row list-row-dense ${row.isHidden ? "opacity-60" : ""}`}
                >
                  <div className="min-w-0">
                    <p className="font-medium">
                      {row.subject.name}
                      <Badge
                        tone={row.isCustom ? "accent" : "neutral"}
                        className="ml-2"
                      >
                        {row.isCustom ? "custom" : "platform"}
                      </Badge>
                      {row.isHidden ? (
                        <Badge tone="warning" className="ml-1">
                          hidden
                        </Badge>
                      ) : null}
                    </p>
                    <p className="text-xs text-[var(--muted)]">
                      {row.subject.category}
                    </p>
                  </div>
                  <span className="flex flex-wrap gap-1.5">
                    {row.isCustom ? (
                      <>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => openEditSubject(row)}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => {
                            if (
                              !window.confirm(
                                `Delete custom subject “${row.subject.name}”?`,
                              )
                            ) {
                              return;
                            }
                            void removeSubject({
                              subjectId: row.subject._id,
                            })
                              .then(() => notify("Subject deleted."))
                              .catch((err) =>
                                notify(
                                  err instanceof Error
                                    ? err.message
                                    : "Failed",
                                  "error",
                                ),
                              );
                          }}
                        >
                          Delete
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            void setHiddenForFamily({
                              familyId: family._id,
                              subjectId: row.subject._id,
                              hidden: !row.isHidden,
                            })
                              .then(() =>
                                notify(
                                  row.isHidden
                                    ? "Subject shown again."
                                    : "Subject hidden for your family.",
                                ),
                              )
                              .catch((err) =>
                                notify(
                                  err instanceof Error
                                    ? err.message
                                    : "Failed",
                                  "error",
                                ),
                              )
                          }
                        >
                          {row.isHidden ? "Unhide" : "Hide"}
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() =>
                            void cloneForFamily({
                              familyId: family._id,
                              subjectId: row.subject._id,
                            })
                              .then(() =>
                                notify("Cloned as a custom subject."),
                              )
                              .catch((err) =>
                                notify(
                                  err instanceof Error
                                    ? err.message
                                    : "Failed",
                                  "error",
                                ),
                              )
                          }
                        >
                          Clone
                        </Button>
                      </>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </TabPanel>

      <TabPanel id="academies" active={tab === "academies"}>
        <Section
          title="Subscriptions"
          description="Opt in to teacher academies for published courses."
          action={
            <Link href="/family/academies">
              <Button variant="ghost" size="sm">
                Full page
              </Button>
            </Link>
          }
        >
          {subscriptions === undefined ? (
            <p className="text-sm text-[var(--muted)]">Loading…</p>
          ) : subscriptions.length === 0 ? (
            <EmptyState>No active subscriptions.</EmptyState>
          ) : (
            <ul className="space-y-1.5">
              {subscriptions.map(({ academy, subscription }) => (
                <li key={subscription._id} className="list-row list-row-dense">
                  <div className="min-w-0">
                    <p className="font-medium">{academy.name}</p>
                    {academy.description ? (
                      <p className="text-xs text-[var(--muted)]">
                        {academy.description}
                      </p>
                    ) : null}
                  </div>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() =>
                      void unsubscribe({
                        familyId: family._id,
                        academyId: academy._id,
                      })
                        .then(() => notify("Unsubscribed."))
                        .catch((err) =>
                          notify(
                            err instanceof Error ? err.message : "Failed",
                            "error",
                          ),
                        )
                    }
                  >
                    Unsubscribe
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Browse academies">
          {academies === undefined ? (
            <p className="text-sm text-[var(--muted)]">Loading…</p>
          ) : academies.length === 0 ? (
            <EmptyState>No academies available yet.</EmptyState>
          ) : (
            <ul className="space-y-1.5">
              {academies.map((a) => {
                const isSub = subscribedIds.has(a._id);
                return (
                  <li key={a._id} className="list-row list-row-dense">
                    <div className="min-w-0">
                      <p className="font-medium">{a.name}</p>
                      {a.description ? (
                        <p className="text-xs text-[var(--muted)]">
                          {a.description}
                        </p>
                      ) : null}
                    </div>
                    {isSub ? (
                      <Badge tone="success">Subscribed</Badge>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() =>
                          void subscribe({
                            familyId: family._id,
                            academyId: a._id,
                          })
                            .then(() => notify("Subscribed."))
                            .catch((err) =>
                              notify(
                                err instanceof Error ? err.message : "Failed",
                                "error",
                              ),
                            )
                        }
                      >
                        Subscribe
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Section>
      </TabPanel>

      <TabPanel id="rewards" active={tab === "rewards"}>
        <Section
          title="Reward catalog"
          description="Students spend points on these rewards."
          action={
            <Button size="sm" onClick={openCreateReward}>
              Add reward
            </Button>
          }
        >
          {rewards === undefined ? (
            <p className="text-sm text-[var(--muted)]">Loading…</p>
          ) : rewards.length === 0 ? (
            <EmptyState>No rewards yet — add one for the shop.</EmptyState>
          ) : (
            <ul className="space-y-1.5">
              {rewards.map((r) => (
                <li key={r._id} className="list-row list-row-dense">
                  <div className="min-w-0">
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
                            notify(
                              r.active ? "Hidden from shop." : "Activated.",
                            ),
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
        <p className="text-sm text-[var(--muted)]">
          Need redemptions?{" "}
          <Link
            href="/family/chores?tab=rewards"
            className="font-medium text-[var(--accent)] underline-offset-2 hover:underline"
          >
            Open chores & rewards
          </Link>
          .
        </p>
      </TabPanel>

      <TabPanel id="notifications" active={tab === "notifications"}>
        <Section
          title="Alert preferences"
          description="Choose which activity creates notifications for you."
          action={
            <Link href="/alerts">
              <Button variant="ghost" size="sm">
                View alerts
              </Button>
            </Link>
          }
        >
          {prefs === undefined ? (
            <p className="text-sm text-[var(--muted)]">Loading…</p>
          ) : (
            <div className="space-y-1.5">
              <PrefToggle
                label="General alerts"
                description="Schedule changes, logs, and system notices."
                checked={prefs.notifyAlerts}
                onChange={(next) =>
                  void updatePrefs({ notifyAlerts: next })
                    .then(() => notify("Preference saved."))
                    .catch((err) =>
                      notify(
                        err instanceof Error ? err.message : "Failed",
                        "error",
                      ),
                    )
                }
              />
              <PrefToggle
                label="Chores"
                description="Assignments and completions."
                checked={prefs.notifyChores}
                onChange={(next) =>
                  void updatePrefs({ notifyChores: next })
                    .then(() => notify("Preference saved."))
                    .catch((err) =>
                      notify(
                        err instanceof Error ? err.message : "Failed",
                        "error",
                      ),
                    )
                }
              />
              <PrefToggle
                label="Kudos & cheers"
                description="When students send or receive cheer messages."
                checked={prefs.notifyKudos}
                onChange={(next) =>
                  void updatePrefs({ notifyKudos: next })
                    .then(() => notify("Preference saved."))
                    .catch((err) =>
                      notify(
                        err instanceof Error ? err.message : "Failed",
                        "error",
                      ),
                    )
                }
              />
              <PrefToggle
                label="AI activity"
                description="When AI tools finish meaningful work."
                checked={prefs.notifyAi}
                onChange={(next) =>
                  void updatePrefs({ notifyAi: next })
                    .then(() => notify("Preference saved."))
                    .catch((err) =>
                      notify(
                        err instanceof Error ? err.message : "Failed",
                        "error",
                      ),
                    )
                }
              />
            </div>
          )}
        </Section>
      </TabPanel>

      <TabPanel id="privacy" active={tab === "privacy"}>
        <Section
          title="Family wall defaults"
          description="Default visibility when students post cheers."
          action={
            <Link href="/family/cheers">
              <Button variant="ghost" size="sm">
                Family wall
              </Button>
            </Link>
          }
        >
          <PrefToggle
            label="Cheers public by default"
            description="Students can still override per message. Individual student settings can override this."
            checked={family.defaultPublicCheer ?? true}
            onChange={(next) =>
              void updateFamily({
                familyId: family._id,
                defaultPublicCheer: next,
              })
                .then(() => notify("Privacy default saved."))
                .catch((err) =>
                  notify(
                    err instanceof Error ? err.message : "Failed",
                    "error",
                  ),
                )
            }
          />
        </Section>
      </TabPanel>

      <TabPanel id="ai" active={tab === "ai"}>
        <Section
          title="Parent guardrails"
          description="Short context the AI should always respect for your family."
          action={
            <Link href="/family/ai">
              <Button variant="ghost" size="sm">
                Open AI tools
              </Button>
            </Link>
          }
        >
          <form
            onSubmit={(e) => void onSaveGuardrail(e)}
            className="space-y-3"
          >
            <Textarea
              label="Guardrail context"
              rows={5}
              value={guardrail}
              onChange={(e) => setGuardrailDraft(e.target.value)}
              placeholder="e.g. Keep suggestions age-appropriate, emphasize outdoor time, avoid screens after 8pm…"
            />
            <Button type="submit" size="sm">
              Save guardrails
            </Button>
          </form>
        </Section>
      </TabPanel>

      <TabPanel id="account" active={tab === "account"}>
        <Section title="Signed in as">
          <ul className="space-y-1.5">
            <li className="list-row list-row-dense">
              <span className="text-sm text-[var(--muted)]">Name</span>
              <span className="text-sm font-medium">
                {user.name ?? "—"}
              </span>
            </li>
            <li className="list-row list-row-dense">
              <span className="text-sm text-[var(--muted)]">Email</span>
              <span className="text-sm font-medium">
                {user.email ?? "—"}
              </span>
            </li>
            <li className="list-row list-row-dense">
              <span className="text-sm text-[var(--muted)]">Role</span>
              <Badge tone="neutral">{user.role ?? "parent"}</Badge>
            </li>
            <li className="list-row list-row-dense">
              <span className="text-sm text-[var(--muted)]">Family</span>
              <span className="text-sm font-medium">{family.name}</span>
            </li>
          </ul>
        </Section>

        <Section title="Help & updates">
          <div className="flex flex-wrap gap-2">
            <Link href="/updates">
              <Button variant="secondary" size="sm">
                What&apos;s new
              </Button>
            </Link>
            <Link href="/help">
              <Button variant="secondary" size="sm">
                Help
              </Button>
            </Link>
            <Button
              variant="danger"
              size="sm"
              onClick={() => void signOut()}
            >
              Sign out
            </Button>
          </div>
        </Section>
      </TabPanel>

      <Modal
        open={subjectOpen}
        onClose={() => setSubjectOpen(false)}
        title={editSubjectId ? "Edit subject" : "Add custom subject"}
        footer={
          <>
            <Button variant="ghost" onClick={() => setSubjectOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="subject-form">
              {editSubjectId ? "Save" : "Create"}
            </Button>
          </>
        }
      >
        <form
          id="subject-form"
          onSubmit={(e) => void onSaveSubject(e)}
          className="space-y-4"
        >
          <Input
            label="Name"
            value={subjectName}
            onChange={(e) => setSubjectName(e.target.value)}
            required
          />
          <Select
            label="Category"
            value={subjectCategory}
            onChange={(e) =>
              setSubjectCategory(e.target.value as SubjectCategory)
            }
          >
            <option value="stem">STEM</option>
            <option value="humanities">Humanities</option>
            <option value="life">Life</option>
            <option value="applied">Applied</option>
          </Select>
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

export default function FamilySettingsPage() {
  return (
    <Suspense
      fallback={<p className="text-sm text-[var(--muted)]">Loading…</p>}
    >
      <FamilySettingsInner />
    </Suspense>
  );
}
