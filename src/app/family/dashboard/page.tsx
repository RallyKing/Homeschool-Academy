"use client";

import Link from "next/link";
import { FormEvent, Suspense, useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { StudentAvatar } from "@/components/StudentAvatar";
import { StudentPhotoEditor } from "@/components/StudentPhotoEditor";
import {
  Button,
  Input,
  Select,
  Modal,
  Section,
  Card,
  PageHeader,
  Badge,
  EmptyState,
  Message,
  Row,
  Col,
  Tabs,
  TabPanel,
} from "@/components/ui";
import { usePageTab } from "@/hooks/usePageTab";

const FAMILY_TABS = ["overview", "students", "household"] as const;

const QUICK_LINKS = [
  { href: "/family/courses", label: "Courses" },
  { href: "/family/planner", label: "Planner" },
  { href: "/family/ledger", label: "Ledger" },
  { href: "/family/progress", label: "Progress" },
  { href: "/family/chores", label: "Chores" },
  { href: "/family/cheers", label: "Family wall" },
  { href: "/family/ai", label: "AI" },
] as const;

function FamilyDashboardInner() {
  const user = useQuery(api.users.current);
  const status = useQuery(api.users.onboardingStatus);
  const family = useQuery(api.users.myFamily);
  const students = useQuery(api.students.listForMyFamily);
  const ensureFamily = useMutation(api.families.ensureMine);
  const updateFamily = useMutation(api.families.update);
  const removeFamily = useMutation(api.families.remove);
  const createStudent = useMutation(api.students.create);
  const updateStudent = useMutation(api.students.update);
  const removeStudent = useMutation(api.students.remove);
  const linkByEmail = useMutation(api.students.linkByEmail);
  const familyMembers = useQuery(
    api.families.listMembers,
    family ? { familyId: family._id } : "skip",
  );
  const removeMember = useMutation(api.families.removeMember);
  const seedSubjects = useMutation(api.subjects.seed);
  const router = useRouter();
  const [tab, setTab] = usePageTab(FAMILY_TABS, "overview");

  const [name, setName] = useState("");
  const [level, setLevel] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [familyNameEdit, setFamilyNameEdit] = useState("");
  const [linkEmail, setLinkEmail] = useState("");
  const [linkStudentId, setLinkStudentId] = useState("");
  const [editStudentId, setEditStudentId] = useState<string>("");
  const [studentModalOpen, setStudentModalOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const familyNameSynced = family?.name ?? "";

  useEffect(() => {
    if (status?.needsOnboarding) {
      router.replace("/onboarding");
    }
  }, [status, router]);

  function openAddStudentModal() {
    setEditStudentId("");
    setName("");
    setLevel("");
    setBirthYear("");
    setStudentModalOpen(true);
  }

  function openEditStudentModal(s: {
    _id: Id<"students">;
    displayName: string;
    academicLevel?: string;
    birthYear?: number;
    imageStorageId?: Id<"_storage">;
  }) {
    setEditStudentId(s._id);
    setName(s.displayName);
    setLevel(s.academicLevel ?? "");
    setBirthYear(s.birthYear ? String(s.birthYear) : "");
    setStudentModalOpen(true);
  }

  function closeStudentModal() {
    setStudentModalOpen(false);
    setEditStudentId("");
    setName("");
    setLevel("");
    setBirthYear("");
  }

  if (user === undefined) {
    return <p className="text-sm text-[var(--muted)]">Loading…</p>;
  }

  if (!user) {
    return <p className="text-sm text-[var(--muted)]">Please sign in.</p>;
  }

  async function setupFamily() {
    setMessage(null);
    try {
      await ensureFamily({});
      try {
        await seedSubjects({});
      } catch {
        /* ok */
      }
      setMessage("Family ready.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed");
    }
  }

  async function onRenameFamily(e: FormEvent) {
    e.preventDefault();
    if (!family) return;
    const nextName = (familyNameEdit || familyNameSynced).trim();
    try {
      await updateFamily({ familyId: family._id, name: nextName });
      setFamilyNameEdit(nextName);
      setMessage("Family name updated.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed");
    }
  }

  async function onAddStudent(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setMessage(null);
    try {
      if (!family) await ensureFamily({});
      await createStudent({
        displayName: name.trim(),
        academicLevel: level.trim() || undefined,
        birthYear: birthYear ? Number(birthYear) : undefined,
      });
      closeStudentModal();
      setMessage("Student added.");
      setTab("students");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed");
    }
  }

  async function onSaveStudent(e: FormEvent) {
    e.preventDefault();
    if (!editStudentId) return;
    try {
      await updateStudent({
        studentId: editStudentId as Id<"students">,
        displayName: name.trim() || undefined,
        academicLevel: level.trim() || undefined,
        birthYear: birthYear ? Number(birthYear) : undefined,
      });
      closeStudentModal();
      setMessage("Student updated.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed");
    }
  }

  async function onLink(e: FormEvent) {
    e.preventDefault();
    if (!linkStudentId || !linkEmail.trim()) return;
    try {
      await linkByEmail({
        studentId: linkStudentId as Id<"students">,
        email: linkEmail.trim(),
      });
      setLinkEmail("");
      setMessage("Student account linked.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed");
    }
  }

  const studentCount = students?.length ?? 0;
  const memberCount = familyMembers?.length ?? 0;

  return (
    <div className="page-stack">
      <PageHeader
        compact
        eyebrow="Family"
        title={family?.name ?? "Your family"}
        description={
          family
            ? "Students, learning tools, and household settings."
            : "Create a family to manage students and learning."
        }
        actions={
          !family ? (
            <Button onClick={() => void setupFamily()}>Create family</Button>
          ) : (
            <Button size="sm" onClick={openAddStudentModal}>
              Add student
            </Button>
          )
        }
      />

      <Message tone="success">{message}</Message>

      {family ? (
        <>
          <Tabs
            tabs={[
              { id: "overview", label: "Overview" },
              { id: "students", label: "Students", count: studentCount },
              { id: "household", label: "Household", count: memberCount },
            ]}
            value={tab}
            onChange={setTab}
          />

          <TabPanel id="overview" active={tab === "overview"}>
            <Row gap="sm">
              <Col span={6} md={3}>
                <Card padding="sm" className="text-center">
                  <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
                    Students
                  </p>
                  <p className="mt-1 font-display text-2xl font-semibold">
                    {studentCount}
                  </p>
                </Card>
              </Col>
              <Col span={6} md={3}>
                <Card padding="sm" className="text-center">
                  <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
                    Members
                  </p>
                  <p className="mt-1 font-display text-2xl font-semibold">
                    {memberCount}
                  </p>
                </Card>
              </Col>
              <Col span={12} md={6}>
                <Card padding="sm">
                  <form
                    onSubmit={(e) => void onRenameFamily(e)}
                    className="flex flex-wrap items-end gap-2"
                  >
                    <div className="min-w-[10rem] flex-1">
                      <Input
                        label="Family name"
                        value={familyNameEdit || familyNameSynced}
                        onChange={(e) => setFamilyNameEdit(e.target.value)}
                      />
                    </div>
                    <Button type="submit" variant="secondary" size="sm">
                      Rename
                    </Button>
                  </form>
                </Card>
              </Col>
            </Row>

            <Section
              title="Tools"
              description="Jump into learning — also in the Learn menu."
            >
              <div className="flex flex-wrap gap-2">
                {QUICK_LINKS.map(({ href, label }) => (
                  <Link key={href} href={href}>
                    <Button variant="secondary" size="sm">
                      {label}
                    </Button>
                  </Link>
                ))}
              </div>
            </Section>

            {students && students.length > 0 ? (
              <Section
                title="Learners"
                action={
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setTab("students")}
                  >
                    Manage all
                  </Button>
                }
              >
                <ul className="space-y-1.5">
                  {students.slice(0, 4).map((s) => (
                    <li key={s._id} className="list-row list-row-dense">
                      <div className="flex min-w-0 items-center gap-3">
                        <StudentAvatar
                          studentId={s._id}
                          imageStorageId={s.imageStorageId}
                          name={s.displayName}
                          size="sm"
                        />
                        <div className="min-w-0">
                          <p className="font-medium">{s.displayName}</p>
                          <p className="text-xs text-[var(--muted)]">
                            {s.academicLevel ?? "Student"}
                          </p>
                        </div>
                      </div>
                      <span className="flex gap-1.5">
                        <Link href={`/family/progress/${s._id}`}>
                          <Button variant="ghost" size="sm">
                            Progress
                          </Button>
                        </Link>
                        <Link href={`/student/dashboard?as=${s._id}`}>
                          <Button variant="secondary" size="sm">
                            View as
                          </Button>
                        </Link>
                      </span>
                    </li>
                  ))}
                </ul>
              </Section>
            ) : (
              <EmptyState>
                No students yet —{" "}
                <button
                  type="button"
                  className="hover-link font-medium text-[var(--accent)] underline-offset-2"
                  onClick={openAddStudentModal}
                >
                  add one
                </button>{" "}
                to get started.
              </EmptyState>
            )}
          </TabPanel>

          <TabPanel id="students" active={tab === "students"}>
            <Section
              title="Students"
              description="Add learners and track their progress."
              action={
                <Button size="sm" onClick={openAddStudentModal}>
                  Add student
                </Button>
              }
            >
              {students === undefined ? (
                <p className="text-sm text-[var(--muted)]">Loading…</p>
              ) : students.length === 0 ? (
                <EmptyState>No students yet — add one to get started.</EmptyState>
              ) : (
                <ul className="space-y-1.5">
                  {students.map((s) => (
                    <li key={s._id} className="list-row list-row-dense">
                      <div className="flex min-w-0 items-center gap-3">
                        <StudentAvatar
                          studentId={s._id}
                          imageStorageId={s.imageStorageId}
                          name={s.displayName}
                          size="md"
                        />
                        <div className="min-w-0">
                          <p className="font-medium text-[var(--foreground)]">
                            {s.displayName}
                          </p>
                          <p className="text-sm text-[var(--muted)]">
                            {[
                              s.academicLevel,
                              s.birthYear ? `born ${s.birthYear}` : null,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                            {s.userId ? (
                              <>
                                {" "}
                                <Badge tone="success" className="ml-1">
                                  linked
                                </Badge>
                              </>
                            ) : null}
                          </p>
                        </div>
                      </div>
                      <span className="flex flex-wrap items-center gap-1.5">
                        <Link href={`/family/students/${s._id}`}>
                          <Button variant="secondary" size="sm">
                            Manage
                          </Button>
                        </Link>
                        <Link href={`/family/progress/${s._id}`}>
                          <Button variant="ghost" size="sm">
                            Progress
                          </Button>
                        </Link>
                        <Link href={`/student/dashboard?as=${s._id}`}>
                          <Button variant="ghost" size="sm">
                            View as
                          </Button>
                        </Link>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditStudentModal(s)}
                        >
                          Quick edit
                        </Button>
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
                              .then(() => setMessage("Student deleted."))
                              .catch((err) =>
                                setMessage(
                                  err instanceof Error ? err.message : "Failed",
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

            {students && students.length > 0 ? (
              <Section
                title="Link student login"
                description="After the student signs up, link their email here."
              >
                <Card>
                  <form onSubmit={(e) => void onLink(e)} className="space-y-4">
                    <Select
                      label="Student"
                      value={linkStudentId || students[0]?._id || ""}
                      onChange={(e) => setLinkStudentId(e.target.value)}
                    >
                      {students.map((s) => (
                        <option key={s._id} value={s._id}>
                          {s.displayName}
                        </option>
                      ))}
                    </Select>
                    <Row gap="sm">
                      <Col span={12} md={8}>
                        <Input
                          type="email"
                          label="Student email"
                          placeholder="student@email.com"
                          value={linkEmail}
                          onChange={(e) => setLinkEmail(e.target.value)}
                          required
                        />
                      </Col>
                      <Col span={12} md={4} className="flex items-end">
                        <Button type="submit" className="w-full md:w-auto">
                          Link account
                        </Button>
                      </Col>
                    </Row>
                  </form>
                </Card>
              </Section>
            ) : null}
          </TabPanel>

          <TabPanel id="household" active={tab === "household"}>
            {familyMembers && familyMembers.length > 0 ? (
              <Section title="Family members">
                <ul className="space-y-1.5">
                  {familyMembers.map(({ membership, email, name: memberName }) => (
                    <li key={membership._id} className="list-row list-row-dense">
                      <span className="text-sm text-[var(--foreground)]">
                        {memberName ?? email ?? membership.userId}
                        <Badge tone="neutral" className="ml-2">
                          {membership.role}
                        </Badge>
                      </span>
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
                              .then(() => setMessage("Member removed."))
                              .catch((err) =>
                                setMessage(
                                  err instanceof Error ? err.message : "Failed",
                                ),
                              );
                          }}
                        >
                          Remove
                        </Button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </Section>
            ) : null}

            <Section title="Utilities">
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() =>
                    void seedSubjects()
                      .then((r) =>
                        setMessage(
                          `Subjects seeded: ${r.created}/${r.total} new`,
                        ),
                      )
                      .catch((err) =>
                        setMessage(
                          err instanceof Error ? err.message : "Failed",
                        ),
                      )
                  }
                >
                  Seed subject taxonomy
                </Button>
                <Link href="/family/academies">
                  <Button variant="secondary" size="sm">
                    Academies
                  </Button>
                </Link>
                <Link href="/family/chores">
                  <Button variant="secondary" size="sm">
                    Chores & rewards
                  </Button>
                </Link>
              </div>
            </Section>

            <Card padding="sm" className="border-[var(--danger)]/20">
              <p className="mb-3 text-sm text-[var(--muted)]">
                Delete this family and all students, logs, schedules, and family
                courses. This cannot be undone.
              </p>
              <Button
                type="button"
                variant="danger"
                size="sm"
                onClick={() => {
                  if (
                    !window.confirm(
                      "Delete this family and all students, logs, schedules, and family courses? This cannot be undone.",
                    )
                  ) {
                    return;
                  }
                  void removeFamily({ familyId: family._id })
                    .then(() => setMessage("Family deleted."))
                    .catch((err) =>
                      setMessage(err instanceof Error ? err.message : "Failed"),
                    );
                }}
              >
                Delete family
              </Button>
            </Card>
          </TabPanel>
        </>
      ) : null}

      <Modal
        open={studentModalOpen}
        onClose={closeStudentModal}
        title={editStudentId ? "Edit student" : "Add student"}
        description={
          editStudentId
            ? "Update this student's profile."
            : "Add a new learner to your family."
        }
        footer={
          <>
            <Button variant="ghost" onClick={closeStudentModal}>
              Cancel
            </Button>
            <Button type="submit" form="student-form">
              {editStudentId ? "Save student" : "Add student"}
            </Button>
          </>
        }
      >
        <form
          id="student-form"
          onSubmit={(e) =>
            void (editStudentId ? onSaveStudent(e) : onAddStudent(e))
          }
          className="space-y-4"
        >
          {editStudentId ? (
            <StudentPhotoEditor
              studentId={editStudentId as Id<"students">}
              imageStorageId={
                students?.find((s) => s._id === editStudentId)?.imageStorageId
              }
              name={name || "Student"}
              size="lg"
              onError={(text) => setMessage(text)}
              onSuccess={(text) => setMessage(text)}
            />
          ) : null}
          <Input
            label="Student name"
            placeholder="Student name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required={!editStudentId}
          />
          <Row gap="sm">
            <Col span={12} md={6}>
              <Input
                label="Level"
                placeholder="e.g. Grade 5"
                value={level}
                onChange={(e) => setLevel(e.target.value)}
              />
            </Col>
            <Col span={12} md={6}>
              <Input
                label="Birth year"
                type="number"
                placeholder="2015"
                value={birthYear}
                onChange={(e) => setBirthYear(e.target.value)}
              />
            </Col>
          </Row>
        </form>
      </Modal>
    </div>
  );
}

export default function FamilyDashboardPage() {
  return (
    <Suspense fallback={<p className="text-sm text-[var(--muted)]">Loading…</p>}>
      <FamilyDashboardInner />
    </Suspense>
  );
}
