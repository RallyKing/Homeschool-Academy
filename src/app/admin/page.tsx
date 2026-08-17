"use client";

import { FormEvent, Suspense, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import {
  Button,
  Input,
  Textarea,
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
import { ReadAlongRecipePanel } from "@/components/ReadAlongRecipePanel";
import { MergeDuplicatesPanel } from "@/components/MergeDuplicatesPanel";
import { withDuplicateNameOverride } from "@/lib/duplicateName";

type SubjectCategory = "stem" | "humanities" | "life" | "applied";
type AppRole = "superAdmin" | "parent" | "teacher" | "student";

const ADMIN_TABS = ["overview", "subjects", "orgs", "users", "readalong"] as const;

function AdminInner() {
  const [tab, setTab] = usePageTab(ADMIN_TABS, "overview");
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
    api.admin.listPlatformSubjects,
    user?.role === "superAdmin" ? {} : "skip",
  );

  const bootstrap = useMutation(api.admin.bootstrapSuperAdmin);
  const seedSubjects = useMutation(api.subjects.seed);

  const createSubject = useMutation(api.admin.createSubject);
  const updateSubject = useMutation(api.admin.updateSubject);
  const removeSubject = useMutation(api.admin.removeSubject);

  const createUser = useMutation(api.admin.createUser);
  const updateUser = useMutation(api.admin.updateUser);
  const removeUser = useMutation(api.admin.removeUser);

  const createFamily = useMutation(api.admin.createFamily);
  const updateFamily = useMutation(api.admin.updateFamily);
  const removeFamily = useMutation(api.admin.removeFamily);

  const createAcademy = useMutation(api.admin.createAcademy);
  const updateAcademy = useMutation(api.admin.updateAcademy);
  const removeAcademy = useMutation(api.admin.removeAcademy);

  const [message, setMessage] = useState<string | null>(null);
  const [messageTone, setMessageTone] = useState<"info" | "error" | "success">(
    "info",
  );

  // Subject modal
  const [subjectModalOpen, setSubjectModalOpen] = useState(false);
  const [editSubjectId, setEditSubjectId] = useState("");
  const [subjectName, setSubjectName] = useState("");
  const [subjectCategory, setSubjectCategory] =
    useState<SubjectCategory>("stem");

  // User modal
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [editUserId, setEditUserId] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [userName, setUserName] = useState("");
  const [userRole, setUserRole] = useState<AppRole>("parent");

  // Family modal
  const [familyModalOpen, setFamilyModalOpen] = useState(false);
  const [editFamilyId, setEditFamilyId] = useState("");
  const [familyName, setFamilyName] = useState("");

  // Academy modal
  const [academyModalOpen, setAcademyModalOpen] = useState(false);
  const [editAcademyId, setEditAcademyId] = useState("");
  const [academyName, setAcademyName] = useState("");
  const [academyDescription, setAcademyDescription] = useState("");
  const [readAlongFamilyId, setReadAlongFamilyId] = useState("");

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

  function openEditSubject(s: {
    _id: Id<"subjects">;
    name: string;
    category: SubjectCategory;
  }) {
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
    } catch (err) {
      notify(err instanceof Error ? err.message : "Failed", "error");
    }
  }

  function openCreateUser() {
    setEditUserId("");
    setUserEmail("");
    setUserName("");
    setUserRole("parent");
    setUserModalOpen(true);
  }

  function openEditUser(u: {
    _id: Id<"users">;
    email?: string;
    name?: string;
    role?: AppRole;
  }) {
    setEditUserId(u._id);
    setUserEmail(u.email ?? "");
    setUserName(u.name ?? "");
    setUserRole(u.role ?? "parent");
    setUserModalOpen(true);
  }

  async function onUserSubmit(e: FormEvent) {
    e.preventDefault();
    try {
      if (editUserId) {
        await updateUser({
          userId: editUserId as Id<"users">,
          email: userEmail.trim() || undefined,
          name: userName.trim(),
          role: userRole,
        });
        notify("User updated.", "success");
      } else {
        if (!userEmail.trim()) {
          notify("Email is required.", "error");
          return;
        }
        await createUser({
          email: userEmail.trim(),
          name: userName.trim() || undefined,
          role: userRole === "superAdmin" ? "parent" : userRole,
        });
        notify("User stub created.", "success");
      }
      setUserModalOpen(false);
    } catch (err) {
      notify(err instanceof Error ? err.message : "Failed", "error");
    }
  }

  function openCreateFamily() {
    setEditFamilyId("");
    setFamilyName("");
    setFamilyModalOpen(true);
  }

  function openEditFamily(f: { _id: Id<"families">; name: string }) {
    setEditFamilyId(f._id);
    setFamilyName(f.name);
    setFamilyModalOpen(true);
  }

  async function onFamilySubmit(e: FormEvent) {
    e.preventDefault();
    if (!familyName.trim()) return;
    try {
      if (editFamilyId) {
        await withDuplicateNameOverride((allowDuplicateName) =>
          updateFamily({
            familyId: editFamilyId as Id<"families">,
            name: familyName.trim(),
            allowDuplicateName,
          }),
        );
        notify("Family updated.", "success");
      } else {
        await withDuplicateNameOverride((allowDuplicateName) =>
          createFamily({ name: familyName.trim(), allowDuplicateName }),
        );
        notify("Family created.", "success");
      }
      setFamilyModalOpen(false);
    } catch (err) {
      notify(err instanceof Error ? err.message : "Failed", "error");
    }
  }

  function openCreateAcademy() {
    setEditAcademyId("");
    setAcademyName("");
    setAcademyDescription("");
    setAcademyModalOpen(true);
  }

  function openEditAcademy(a: {
    _id: Id<"academies">;
    name: string;
    description?: string;
  }) {
    setEditAcademyId(a._id);
    setAcademyName(a.name);
    setAcademyDescription(a.description ?? "");
    setAcademyModalOpen(true);
  }

  async function onAcademySubmit(e: FormEvent) {
    e.preventDefault();
    if (!academyName.trim()) return;
    try {
      if (editAcademyId) {
        await updateAcademy({
          academyId: editAcademyId as Id<"academies">,
          name: academyName.trim(),
          description: academyDescription.trim() || undefined,
        });
        notify("Academy updated.", "success");
      } else {
        await createAcademy({
          name: academyName.trim(),
          description: academyDescription.trim() || undefined,
        });
        notify("Academy created.", "success");
      }
      setAcademyModalOpen(false);
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
      <Link href="/admin/accounts">
        <Button variant="secondary" size="sm">
          Accounts
        </Button>
      </Link>
      <Link href="/admin/product-updates">
        <Button variant="secondary" size="sm">
          Updates
        </Button>
      </Link>
      <Link href="/admin/knowledge-base">
        <Button variant="secondary" size="sm">
          KB
        </Button>
      </Link>
    </div>
  );

  const overviewQuickActions: Array<{
    label: string;
    tab: (typeof ADMIN_TABS)[number];
    count?: number;
  }> = [
    { label: "Manage subjects", tab: "subjects", count: subjects?.length },
    { label: "Manage orgs", tab: "orgs" },
    { label: "Manage users", tab: "users", count: users?.length },
  ];

  return (
    <div className="page-stack">
      <PageHeader
        compact
        eyebrow="Platform"
        title="God Mode"
        description="Platform overview and administration."
        actions={navLinks}
      />

      <Message tone={messageTone}>{message}</Message>

      <Tabs
        tabs={[
          { id: "overview", label: "Overview" },
          { id: "subjects", label: "Subjects", count: subjects?.length },
          { id: "orgs", label: "Orgs" },
          { id: "users", label: "Users", count: users?.length },
          { id: "readalong", label: "Read-along" },
        ]}
        value={tab}
        onChange={setTab}
      />

      <TabPanel id="overview" active={tab === "overview"}>
        {overview ? (
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
                    <p className="mt-1 font-display text-2xl font-semibold">
                      {count}
                    </p>
                  </Card>
                </Col>
              ))}
            </Row>
            <Card padding="sm">
              <p className="text-sm text-[var(--muted)]">
                Roles — admin {overview.usersByRole.superAdmin}, parent{" "}
                {overview.usersByRole.parent}, teacher{" "}
                {overview.usersByRole.teacher}, student{" "}
                {overview.usersByRole.student}, unset{" "}
                {overview.usersByRole.unset}
              </p>
            </Card>
            <Section title="Quick actions">
              <div className="flex flex-wrap gap-2">
                {overviewQuickActions.map((action) => (
                  <Button
                    key={action.tab}
                    variant="secondary"
                    size="sm"
                    onClick={() => setTab(action.tab)}
                  >
                    {action.label}
                    {action.count !== undefined ? ` (${action.count})` : ""}
                  </Button>
                ))}
              </div>
            </Section>
          </>
        ) : (
          <p className="text-sm text-[var(--muted)]">Loading overview…</p>
        )}
      </TabPanel>

      <TabPanel id="subjects" active={tab === "subjects"}>
        <Section
          title="Platform subjects"
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
                      notify(
                        err instanceof Error ? err.message : "Failed",
                        "error",
                      ),
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
            <EmptyState>No platform subjects yet.</EmptyState>
          ) : (
            <div className="space-y-1.5">
              {subjects.map((s) => (
                <div key={s._id} className="list-row list-row-dense">
                  <div>
                    <span className="font-medium">{s.name}</span>
                    <Badge tone="neutral" className="ml-2">
                      {s.category}
                    </Badge>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditSubject(s)}
                    >
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
                            notify(
                              err instanceof Error ? err.message : "Failed",
                              "error",
                            ),
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
      </TabPanel>

      <TabPanel id="orgs" active={tab === "orgs"}>
        <Row gap="lg">
          <Col span={12} md={6}>
            <Section
              title="Families"
              action={
                <Button size="sm" onClick={openCreateFamily}>
                  Add family
                </Button>
              }
            >
              {families === undefined ? (
                <p className="text-sm text-[var(--muted)]">Loading…</p>
              ) : families.length === 0 ? (
                <EmptyState>No families yet.</EmptyState>
              ) : (
                <div className="space-y-1.5">
                  {families.map((f) => (
                    <div key={f._id} className="list-row list-row-dense">
                      <span className="font-medium">{f.name}</span>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditFamily(f)}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => {
                            if (
                              !window.confirm(
                                `Delete family "${f.name}" and all related students, courses, and data? This cannot be undone.`,
                              )
                            ) {
                              return;
                            }
                            void removeFamily({ familyId: f._id })
                              .then(() =>
                                notify("Family deleted.", "success"),
                              )
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
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Section>
          </Col>
          <Col span={12} md={6}>
            <Section
              title="Academies"
              action={
                <Button size="sm" onClick={openCreateAcademy}>
                  Add academy
                </Button>
              }
            >
              {academies === undefined ? (
                <p className="text-sm text-[var(--muted)]">Loading…</p>
              ) : academies.length === 0 ? (
                <EmptyState>No academies yet.</EmptyState>
              ) : (
                <div className="space-y-1.5">
                  {academies.map((a) => (
                    <div key={a._id} className="list-row list-row-dense">
                      <div className="min-w-0">
                        <span className="font-medium">{a.name}</span>
                        {a.description ? (
                          <p className="truncate text-xs text-[var(--muted)]">
                            {a.description}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditAcademy(a)}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => {
                            if (
                              !window.confirm(
                                `Delete academy "${a.name}" and cascade courses/memberships? This cannot be undone.`,
                              )
                            ) {
                              return;
                            }
                            void removeAcademy({ academyId: a._id })
                              .then(() =>
                                notify("Academy deleted.", "success"),
                              )
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
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Section>
          </Col>
        </Row>
        <div className="mt-8">
          <MergeDuplicatesPanel />
        </div>
      </TabPanel>

      <TabPanel id="users" active={tab === "users"}>
        <Section
          title="Users"
          action={
            <Button size="sm" onClick={openCreateUser}>
              Add user
            </Button>
          }
        >
          {users === undefined ? (
            <p className="text-sm text-[var(--muted)]">Loading…</p>
          ) : users.length === 0 ? (
            <EmptyState>No users yet.</EmptyState>
          ) : (
            <div className="space-y-1.5">
              {users.map((u) => {
                const isSelf = u._id === user._id;
                return (
                  <div key={u._id} className="list-row list-row-dense">
                    <div className="min-w-0">
                      <span className="font-medium">
                        {u.email ?? u.name ?? u._id}
                      </span>
                      {u.name && u.email ? (
                        <span className="ml-2 text-sm text-[var(--muted)]">
                          {u.name}
                        </span>
                      ) : null}
                      <Badge
                        tone={u.role === "superAdmin" ? "accent" : "neutral"}
                        className="ml-2"
                      >
                        {u.role ?? "unset"}
                      </Badge>
                      {isSelf ? (
                        <Badge tone="neutral" className="ml-2">
                          you
                        </Badge>
                      ) : null}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditUser(u)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        disabled={isSelf}
                        onClick={() => {
                          if (isSelf) return;
                          const label = u.email ?? u.name ?? "this user";
                          if (
                            !window.confirm(
                              `Delete ${label}? This removes memberships and auth sessions. Orgs they created will be reassigned to you.`,
                            )
                          ) {
                            return;
                          }
                          void removeUser({ userId: u._id })
                            .then(() => notify("User deleted.", "success"))
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
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Section>
      </TabPanel>

      <TabPanel id="readalong" active={tab === "readalong"}>
        <Section
          title="Story recipes by school"
          description="Pick a family/school, then create or edit the recipes that control generated read-along stories."
        >
          <div className="max-w-md">
            <Select
              label="School / family"
              value={readAlongFamilyId}
              onChange={(e) => setReadAlongFamilyId(e.target.value)}
            >
              <option value="">Choose…</option>
              {(families ?? []).map((f) => (
                <option key={f._id} value={f._id}>
                  {f.name}
                </option>
              ))}
            </Select>
          </div>
        </Section>
        {readAlongFamilyId ? (
          <ReadAlongRecipePanel
            familyId={readAlongFamilyId as Id<"families">}
          />
        ) : (
          <EmptyState>Select a school to manage its story recipes.</EmptyState>
        )}
      </TabPanel>

      <Modal
        open={subjectModalOpen}
        onClose={() => setSubjectModalOpen(false)}
        title={editSubjectId ? "Edit subject" : "Add subject"}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setSubjectModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" form="subject-form">
              {editSubjectId ? "Save subject" : "Add subject"}
            </Button>
          </>
        }
      >
        <form
          id="subject-form"
          onSubmit={(e) => void onSubjectSubmit(e)}
          className="space-y-4"
        >
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
        open={userModalOpen}
        onClose={() => setUserModalOpen(false)}
        title={editUserId ? "Edit user" : "Add user"}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setUserModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" form="user-form">
              {editUserId ? "Save user" : "Create stub"}
            </Button>
          </>
        }
      >
        <form
          id="user-form"
          onSubmit={(e) => void onUserSubmit(e)}
          className="space-y-4"
        >
          <Input
            label="Email"
            type="email"
            placeholder="user@example.com"
            value={userEmail}
            onChange={(e) => setUserEmail(e.target.value)}
            required={!editUserId}
          />
          <Input
            label="Display name"
            placeholder="Optional name"
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
          />
          <Select
            label="Role"
            value={userRole}
            onChange={(e) => setUserRole(e.target.value as AppRole)}
          >
            {editUserId ? (
              <option value="superAdmin">superAdmin</option>
            ) : null}
            <option value="parent">parent</option>
            <option value="teacher">teacher</option>
            <option value="student">student</option>
          </Select>
          {!editUserId ? (
            <p className="text-xs text-[var(--muted)]">
              Creates a user row only — they still need to sign up with this
              email. Grant superAdmin after they exist via Edit.
            </p>
          ) : null}
        </form>
      </Modal>

      <Modal
        open={familyModalOpen}
        onClose={() => setFamilyModalOpen(false)}
        title={editFamilyId ? "Edit family" : "Add family"}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setFamilyModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" form="family-form">
              {editFamilyId ? "Save family" : "Add family"}
            </Button>
          </>
        }
      >
        <form
          id="family-form"
          onSubmit={(e) => void onFamilySubmit(e)}
          className="space-y-4"
        >
          <Input
            label="Family name"
            placeholder="Household name"
            value={familyName}
            onChange={(e) => setFamilyName(e.target.value)}
            required
          />
        </form>
      </Modal>

      <Modal
        open={academyModalOpen}
        onClose={() => setAcademyModalOpen(false)}
        title={editAcademyId ? "Edit academy" : "Add academy"}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setAcademyModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" form="academy-form">
              {editAcademyId ? "Save academy" : "Add academy"}
            </Button>
          </>
        }
      >
        <form
          id="academy-form"
          onSubmit={(e) => void onAcademySubmit(e)}
          className="space-y-4"
        >
          <Input
            label="Academy name"
            placeholder="Academy name"
            value={academyName}
            onChange={(e) => setAcademyName(e.target.value)}
            required
          />
          <Textarea
            label="Description"
            placeholder="Optional description"
            value={academyDescription}
            onChange={(e) => setAcademyDescription(e.target.value)}
            rows={3}
          />
        </form>
      </Modal>
    </div>
  );
}

export default function AdminPage() {
  return (
    <Suspense fallback={<p className="text-sm text-[var(--muted)]">Loading…</p>}>
      <AdminInner />
    </Suspense>
  );
}
