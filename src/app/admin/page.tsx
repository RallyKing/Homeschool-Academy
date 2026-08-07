"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
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

type SubjectCategory = "stem" | "humanities" | "life" | "applied";

export default function AdminPage() {
  const user = useQuery(api.users.current);
  const overview = useQuery(
    api.admin.overview,
    user?.role === "superAdmin" ? {} : "skip",
  );
  const users = useQuery(
    api.admin.listUsers,
    user?.role === "superAdmin" ? {} : "skip",
  );
  const families = useQuery(
    api.admin.listFamilies,
    user?.role === "superAdmin" ? {} : "skip",
  );
  const academies = useQuery(
    api.admin.listAcademies,
    user?.role === "superAdmin" ? {} : "skip",
  );
  const subjects = useQuery(
    api.subjects.list,
    user?.role === "superAdmin" ? {} : "skip",
  );
  const bootstrap = useMutation(api.admin.bootstrapSuperAdmin);
  const promote = useMutation(api.admin.promoteToSuperAdmin);
  const seedSubjects = useMutation(api.subjects.seed);
  const createSubject = useMutation(api.subjects.create);
  const updateSubject = useMutation(api.subjects.update);
  const removeSubject = useMutation(api.subjects.remove);
  const [message, setMessage] = useState<string | null>(null);
  const [messageTone, setMessageTone] = useState<"info" | "error" | "success">("info");
  const [subjectName, setSubjectName] = useState("");
  const [subjectCategory, setSubjectCategory] =
    useState<SubjectCategory>("stem");
  const [editSubjectId, setEditSubjectId] = useState("");
  const [subjectModalOpen, setSubjectModalOpen] = useState(false);

  function notify(text: string, tone: "info" | "error" | "success" = "info") {
    setMessage(text);
    setMessageTone(tone);
  }

  function openCreateSubject() {
    setEditSubjectId("");
    setSubjectName("");
    setSubjectCategory("stem");
    setSubjectModalOpen(true);
  }

  function openEditSubject(s: { _id: Id<"subjects">; name: string; category: SubjectCategory }) {
    setEditSubjectId(s._id);
    setSubjectName(s.name);
    setSubjectCategory(s.category);
    setSubjectModalOpen(true);
  }

  async function onSubjectSubmit(e: FormEvent) {
    e.preventDefault();
    if (!subjectName.trim()) return;
    try {
      if (editSubjectId) {
        await updateSubject({
          subjectId: editSubjectId as Id<"subjects">,
          name: subjectName.trim(),
          category: subjectCategory,
        });
        notify("Subject updated.", "success");
      } else {
        await createSubject({
          name: subjectName.trim(),
          category: subjectCategory,
        });
        notify("Subject created.", "success");
      }
      setSubjectModalOpen(false);
      setEditSubjectId("");
      setSubjectName("");
    } catch (err) {
      notify(err instanceof Error ? err.message : "Failed", "error");
    }
  }

  if (user === undefined) {
    return <p className="text-sm text-[var(--muted)]">Loading…</p>;
  }

  if (!user) {
    return <p className="text-sm text-[var(--muted)]">Please sign in.</p>;
  }

  if (user.role !== "superAdmin") {
    return (
      <div className="space-y-8">
        <PageHeader
          eyebrow="Admin"
          title="Access required"
          description="SuperAdmin access required. If this is a fresh deployment with no admin yet, claim God Mode once."
        />
        <Card padding="lg" className="max-w-md">
          <Button
            onClick={() =>
              void bootstrap()
                .then(() => notify("You are now superAdmin. Refresh.", "success"))
                .catch((err) =>
                  notify(err instanceof Error ? err.message : "Failed", "error"),
                )
            }
          >
            Bootstrap superAdmin
          </Button>
        </Card>
        <Message tone={messageTone}>{message}</Message>
      </div>
    );
  }

  const navLinks = (
    <div className="flex flex-wrap gap-2">
      <Link href="/admin/product-updates">
        <Button variant="secondary" size="sm">
          Product updates
        </Button>
      </Link>
      <Link href="/admin/knowledge-base">
        <Button variant="secondary" size="sm">
          Knowledge base
        </Button>
      </Link>
      <Link href="/updates">
        <Button variant="ghost" size="sm">
          Updates feed
        </Button>
      </Link>
      <Link href="/help">
        <Button variant="ghost" size="sm">
          Help
        </Button>
      </Link>
    </div>
  );

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Platform"
        title="God Mode"
        description="Platform overview and administration."
        actions={navLinks}
      />

      <Message tone={messageTone}>{message}</Message>

      {overview && (
        <>
          <Row gap="md">
            {(
              [
                ["Users", overview.userCount],
                ["Families", overview.familyCount],
                ["Academies", overview.academyCount],
                ["Students", overview.studentCount],
                ["Courses", overview.courseCount],
                ["Logs", overview.logCount],
                ["Subjects", overview.subjectCount],
              ] as const
            ).map(([label, count]) => (
              <Col key={label} span={6} md={4} lg={3}>
                <Card padding="sm" className="text-center">
                  <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
                    {label}
                  </p>
                  <p className="mt-1 font-display text-2xl font-semibold">{count}</p>
                </Card>
              </Col>
            ))}
          </Row>

          <Card padding="sm">
            <p className="text-sm text-[var(--muted)]">
              Roles — admin {overview.usersByRole.superAdmin}, parent{" "}
              {overview.usersByRole.parent}, teacher {overview.usersByRole.teacher},
              student {overview.usersByRole.student}, unset{" "}
              {overview.usersByRole.unset}
            </p>
          </Card>
        </>
      )}

      <Section
        title="Subjects"
        action={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() =>
                void seedSubjects()
                  .then((r) =>
                    notify(
                      `Subjects: ${r.created} created / ${r.total} total`,
                      "success",
                    ),
                  )
                  .catch((err) =>
                    notify(err instanceof Error ? err.message : "Failed", "error"),
                  )
              }
            >
              Seed subjects
            </Button>
            <Button size="sm" onClick={openCreateSubject}>
              Add subject
            </Button>
          </div>
        }
      >
        {subjects === undefined ? (
          <p className="text-sm text-[var(--muted)]">Loading…</p>
        ) : subjects.length === 0 ? (
          <EmptyState>No subjects yet.</EmptyState>
        ) : (
          <div className="space-y-2">
            {subjects.map((s) => (
              <div key={s._id} className="list-row">
                <div>
                  <span className="font-medium">{s.name}</span>
                  <Badge tone="neutral" className="ml-2">
                    {s.category}
                  </Badge>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => openEditSubject(s)}>
                    Edit
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => {
                      if (!window.confirm(`Delete subject "${s.name}"?`)) {
                        return;
                      }
                      void removeSubject({ subjectId: s._id })
                        .then(() => notify("Subject deleted.", "success"))
                        .catch((err) =>
                          notify(err instanceof Error ? err.message : "Failed", "error"),
                        );
                    }}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Row gap="lg">
        <Col span={12} md={6}>
          <Section title="Families">
            {families === undefined ? (
              <p className="text-sm text-[var(--muted)]">Loading…</p>
            ) : families.length === 0 ? (
              <EmptyState>None</EmptyState>
            ) : (
              <div className="space-y-2">
                {families.map((f) => (
                  <div key={f._id} className="list-row">
                    <span className="font-medium">{f.name}</span>
                  </div>
                ))}
              </div>
            )}
          </Section>
        </Col>

        <Col span={12} md={6}>
          <Section title="Academies">
            {academies === undefined ? (
              <p className="text-sm text-[var(--muted)]">Loading…</p>
            ) : academies.length === 0 ? (
              <EmptyState>None</EmptyState>
            ) : (
              <div className="space-y-2">
                {academies.map((a) => (
                  <div key={a._id} className="list-row">
                    <span className="font-medium">{a.name}</span>
                  </div>
                ))}
              </div>
            )}
          </Section>
        </Col>
      </Row>

      <Section title="Users">
        {users === undefined ? (
          <p className="text-sm text-[var(--muted)]">Loading…</p>
        ) : (
          <div className="space-y-2">
            {users.map((u) => (
              <div key={u._id} className="list-row">
                <div className="min-w-0">
                  <span className="font-medium">
                    {u.email ?? u.name ?? u._id}
                  </span>
                  <Badge tone="neutral" className="ml-2">
                    {u.role ?? "unset"}
                  </Badge>
                </div>
                {u.role !== "superAdmin" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      void promote({ userId: u._id as Id<"users"> })
                        .then(() => notify(`Promoted ${u.email}`, "success"))
                        .catch((err) =>
                          notify(err instanceof Error ? err.message : "Failed", "error"),
                        )
                    }
                  >
                    Promote
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </Section>

      <Modal
        open={subjectModalOpen}
        onClose={() => setSubjectModalOpen(false)}
        title={editSubjectId ? "Edit subject" : "Add subject"}
        footer={
          <>
            <Button variant="secondary" onClick={() => setSubjectModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="subject-form">
              {editSubjectId ? "Save subject" : "Add subject"}
            </Button>
          </>
        }
      >
        <form id="subject-form" onSubmit={(e) => void onSubjectSubmit(e)} className="space-y-4">
          <Input
            label="Subject name"
            placeholder="Subject name"
            value={subjectName}
            onChange={(e) => setSubjectName(e.target.value)}
            required
          />
          <Select
            label="Category"
            value={subjectCategory}
            onChange={(e) => setSubjectCategory(e.target.value as SubjectCategory)}
          >
            <option value="stem">STEM</option>
            <option value="humanities">Humanities</option>
            <option value="life">Life</option>
            <option value="applied">Applied</option>
          </Select>
        </form>
      </Modal>
    </div>
  );
}
