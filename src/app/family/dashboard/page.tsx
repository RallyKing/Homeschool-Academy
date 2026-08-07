"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
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
} from "@/components/ui";

const NAV_LINKS = [
  { href: "/family/courses", label: "Courses" },
  { href: "/family/academies", label: "Academies" },
  { href: "/family/planner", label: "Planner" },
  { href: "/family/ledger", label: "Ledger" },
  { href: "/family/progress", label: "Progress" },
  { href: "/family/ai", label: "AI guardrails" },
] as const;

export default function FamilyDashboardPage() {
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

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Family"
        title={family?.name ?? "Your family"}
        description={
          family
            ? "Manage students, courses, and learning records."
            : "Create a family to manage students and learning."
        }
        actions={
          !family ? (
            <Button onClick={() => void setupFamily()}>Create family</Button>
          ) : undefined
        }
      />

      {family && (
        <Card padding="sm">
          <form
            onSubmit={(e) => void onRenameFamily(e)}
            className="flex flex-wrap items-end gap-3"
          >
            <div className="min-w-[12rem] flex-1">
              <Input
                label="Family name"
                value={familyNameEdit || familyNameSynced}
                onChange={(e) => setFamilyNameEdit(e.target.value)}
              />
            </div>
            <Button type="submit" variant="secondary" size="sm">
              Rename
            </Button>
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
          </form>
        </Card>
      )}

      <nav className="flex flex-wrap gap-2">
        {NAV_LINKS.map(({ href, label }) => (
          <Link key={href} href={href}>
            <Button variant="secondary" size="sm">
              {label}
            </Button>
          </Link>
        ))}
      </nav>

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
          <ul className="space-y-2">
            {students.map((s) => (
              <li key={s._id} className="list-row">
                <div className="min-w-0">
                  <p className="font-medium text-[var(--foreground)]">
                    {s.displayName}
                  </p>
                  <p className="text-sm text-[var(--muted)]">
                    {[s.academicLevel, s.birthYear ? `born ${s.birthYear}` : null]
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
                <span className="flex flex-wrap items-center gap-2">
                  <Link href={`/family/progress/${s._id}`}>
                    <Button variant="ghost" size="sm">
                      Progress
                    </Button>
                  </Link>
                  <Link href={`/student/dashboard?as=${s._id}`}>
                    <Button variant="ghost" size="sm">
                      View as student
                    </Button>
                  </Link>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => openEditStudentModal(s)}
                  >
                    Edit
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

      {family && familyMembers && familyMembers.length > 0 && (
        <Section title="Family members">
          <ul className="space-y-2">
            {familyMembers.map(({ membership, email, name: memberName }) => (
              <li key={membership._id} className="list-row">
                <span className="text-sm text-[var(--foreground)]">
                  {memberName ?? email ?? membership.userId}
                  <Badge tone="neutral" className="ml-2">
                    {membership.role}
                  </Badge>
                </span>
                {membership.userId !== family.createdBy && (
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => {
                      if (!window.confirm("Remove this family member?")) return;
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
                )}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {students && students.length > 0 && (
        <Section
          title="Link student login"
          description="After the student signs up with their email, link them here."
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
      )}

      <Section title="Get started">
        <p className="text-sm text-[var(--muted)]">
          Set up courses, plan the week, then log learning time.
        </p>
        <div className="flex flex-wrap gap-2">
          <Link href="/family/courses">
            <Button variant="secondary" size="sm">
              Add courses
            </Button>
          </Link>
          <Link href="/family/planner">
            <Button variant="secondary" size="sm">
              Plan a week
            </Button>
          </Link>
          <Link href="/family/ledger">
            <Button variant="secondary" size="sm">
              Log learning time
            </Button>
          </Link>
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              void seedSubjects()
                .then((r) =>
                  setMessage(`Subjects seeded: ${r.created}/${r.total} new`),
                )
                .catch((err) =>
                  setMessage(err instanceof Error ? err.message : "Failed"),
                )
            }
          >
            Seed subject taxonomy
          </Button>
        </div>
      </Section>

      <Message tone="success">{message}</Message>

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
            <Button
              type="submit"
              form="student-form"
            >
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
