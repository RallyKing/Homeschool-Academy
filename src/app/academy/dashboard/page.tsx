"use client";

import { FormEvent, Suspense, useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
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

type EditTarget =
  | { kind: "course"; id: Id<"courses">; title: string }
  | { kind: "module"; id: Id<"modules">; title: string }
  | { kind: "lesson"; id: Id<"lessons">; title: string }
  | null;

const ACADEMY_TABS = ["academies", "courses", "subscribers"] as const;

function AcademyDashboardInner() {
  const [tab, setTab] = usePageTab(ACADEMY_TABS, "academies");
  const user = useQuery(api.users.current);
  const status = useQuery(api.users.onboardingStatus);
  const academies = useQuery(api.academies.myAcademies);
  const subjects = useQuery(api.subjects.list);
  const createAcademy = useMutation(api.academies.create);
  const updateAcademy = useMutation(api.academies.update);
  const removeAcademy = useMutation(api.academies.remove);
  const createCourse = useMutation(api.courses.create);
  const updateCourse = useMutation(api.courses.update);
  const removeCourse = useMutation(api.courses.remove);
  const addModule = useMutation(api.courses.addModule);
  const updateModule = useMutation(api.courses.updateModule);
  const removeModule = useMutation(api.courses.removeModule);
  const addLesson = useMutation(api.courses.addLesson);
  const updateLesson = useMutation(api.courses.updateLesson);
  const removeLesson = useMutation(api.courses.removeLesson);
  const seedSubjects = useMutation(api.subjects.seed);
  const router = useRouter();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedAcademy, setSelectedAcademy] = useState("");
  const [courseTitle, setCourseTitle] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [moduleTitle, setModuleTitle] = useState("");
  const [lessonTitle, setLessonTitle] = useState("");
  const [selectedCourse, setSelectedCourse] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [messageTone, setMessageTone] = useState<"info" | "error" | "success">("info");

  const [academyModalOpen, setAcademyModalOpen] = useState(false);
  const [academyModalMode, setAcademyModalMode] = useState<"create" | "edit">("create");
  const [courseModalOpen, setCourseModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<EditTarget>(null);
  const [editTitle, setEditTitle] = useState("");

  useEffect(() => {
    if (status?.needsOnboarding) {
      router.replace("/onboarding");
    }
  }, [status, router]);

  const academyId = (selectedAcademy || academies?.[0]?._id || "") as
    | Id<"academies">
    | "";

  const selectedAcademyDoc = academies?.find((a) => a._id === academyId);

  const courses = useQuery(
    api.courses.listForAcademy,
    academyId ? { academyId } : "skip",
  );

  const subscribers = useQuery(
    api.academies.listSubscribers,
    academyId ? { academyId } : "skip",
  );

  const structure = useQuery(
    api.courses.getStructure,
    selectedCourse
      ? { courseId: selectedCourse as Id<"courses"> }
      : "skip",
  );

  function notify(text: string, tone: "info" | "error" | "success" = "info") {
    setMessage(text);
    setMessageTone(tone);
  }

  function openCreateAcademy() {
    setAcademyModalMode("create");
    setName("");
    setDescription("");
    setAcademyModalOpen(true);
  }

  function openEditAcademy() {
    if (!selectedAcademyDoc) return;
    setAcademyModalMode("edit");
    setName(selectedAcademyDoc.name);
    setDescription(selectedAcademyDoc.description ?? "");
    setAcademyModalOpen(true);
  }

  async function onAcademySubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setMessage(null);
    try {
      if (academyModalMode === "edit" && academyId) {
        await updateAcademy({
          academyId,
          name: name.trim(),
          description: description.trim() || undefined,
        });
        notify("Academy updated.", "success");
      } else {
        const id = await createAcademy({
          name: name.trim(),
          description: description.trim() || undefined,
        });
        setSelectedAcademy(id);
        notify("Academy created.", "success");
      }
      setAcademyModalOpen(false);
    } catch (err) {
      notify(err instanceof Error ? err.message : "Failed", "error");
    }
  }

  async function onCreateCourse(e: FormEvent) {
    e.preventDefault();
    if (!academyId || !courseTitle.trim()) return;
    try {
      if (!subjects || subjects.length === 0) {
        await seedSubjects({});
      }
      const sid = (subjectId || subjects?.[0]?._id) as Id<"subjects"> | undefined;
      if (!sid) {
        notify("Seed subjects first.", "error");
        return;
      }
      const id = await createCourse({
        type: "native",
        title: courseTitle.trim(),
        subjectId: sid,
        ownerType: "academy",
        academyId,
      });
      setCourseTitle("");
      setSelectedCourse(id);
      setCourseModalOpen(false);
      notify("Course published.", "success");
    } catch (err) {
      notify(err instanceof Error ? err.message : "Failed", "error");
    }
  }

  async function onEditSubmit(e: FormEvent) {
    e.preventDefault();
    if (!editTarget || !editTitle.trim()) return;
    try {
      if (editTarget.kind === "course") {
        await updateCourse({ courseId: editTarget.id, title: editTitle.trim() });
        notify("Course updated.", "success");
      } else if (editTarget.kind === "module") {
        await updateModule({ moduleId: editTarget.id, title: editTitle.trim() });
        notify("Module updated.", "success");
      } else {
        await updateLesson({ lessonId: editTarget.id, title: editTitle.trim() });
        notify("Lesson updated.", "success");
      }
      setEditTarget(null);
      setEditTitle("");
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

  return (
    <div className="page-stack">
      <PageHeader
        compact
        eyebrow="Academy"
        title="Dashboard"
        description="Publish courses and see which families have subscribed."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/academy/cheers">
              <Button size="sm" variant="secondary">
                Student cheers
              </Button>
            </Link>
            <Button size="sm" onClick={openCreateAcademy}>
              New academy
            </Button>
          </div>
        }
      />

      <Message tone={messageTone}>{message}</Message>

      <Tabs
        tabs={[
          { id: "academies", label: "Academies", count: academies?.length },
          { id: "courses", label: "Courses", count: courses?.length },
          { id: "subscribers", label: "Subscribers", count: subscribers?.length },
        ]}
        value={tab}
        onChange={setTab}
      />

      <TabPanel id="academies" active={tab === "academies"}>
      <Section title="My academies" description="Select an academy to manage courses.">
        {academies === undefined ? (
          <p className="text-sm text-[var(--muted)]">Loading…</p>
        ) : academies.length === 0 ? (
          <EmptyState>
            No academies yet.{" "}
            <button
              type="button"
              className="hover-link text-[var(--accent)] underline-offset-2"
              onClick={openCreateAcademy}
            >
              Create your first academy
            </button>
          </EmptyState>
        ) : (
          <div className="space-y-2">
            {academies.map((a) => (
              <button
                key={a._id}
                type="button"
                className={`list-row w-full text-left ${
                  academyId === a._id ? "ring-2 ring-[var(--accent-soft)]" : ""
                }`}
                onClick={() => { setSelectedAcademy(a._id); setTab("courses"); }}
              >
                <div className="min-w-0">
                  <p className="font-medium text-[var(--foreground)]">{a.name}</p>
                  {a.description ? (
                    <p className="mt-0.5 truncate text-sm text-[var(--muted)]">
                      {a.description}
                    </p>
                  ) : null}
                </div>
                {academyId === a._id && <Badge tone="accent">Active</Badge>}
              </button>
            ))}
          </div>
        )}
      </Section>

      {academyId && selectedAcademyDoc && (
        <>
          <Section
            title="Academy profile"
            action={
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" size="sm" onClick={openEditAcademy}>
                  Edit
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => {
                    if (
                      !window.confirm(
                        "Delete this academy, its courses, and all subscriptions?",
                      )
                    ) {
                      return;
                    }
                    void removeAcademy({ academyId })
                      .then(() => {
                        setSelectedAcademy("");
                        setSelectedCourse("");
                        notify("Academy deleted.", "success");
                      })
                      .catch((err) =>
                        notify(err instanceof Error ? err.message : "Failed", "error"),
                      );
                  }}
                >
                  Delete
                </Button>
              </div>
            }
          >
            <Card>
              <p className="font-display text-lg font-semibold">{selectedAcademyDoc.name}</p>
              {selectedAcademyDoc.description ? (
                <p className="mt-2 text-sm text-[var(--muted)]">
                  {selectedAcademyDoc.description}
                </p>
              ) : (
                <p className="mt-2 text-sm text-[var(--muted-fg)]">No description</p>
              )}
            </Card>
          </Section>
        </>
      )}
      {(!academyId || !selectedAcademyDoc) && (
        <EmptyState>Select or create an academy above.</EmptyState>
      )}
      </TabPanel>

      <TabPanel id="courses" active={tab === "courses"}>
      {!academyId ? (
        <EmptyState>Select an academy in the Academies tab first.</EmptyState>
      ) : (
        <>
          <Section
            title="Courses"
            description="Native courses published under this academy."
            action={
              <Button size="sm" onClick={() => setCourseModalOpen(true)}>
                Publish course
              </Button>
            }
          >
            {(courses ?? []).length === 0 ? (
              <EmptyState>No courses yet. Publish your first course.</EmptyState>
            ) : (
              <div className="space-y-2">
                {(courses ?? []).map((c) => (
                  <div
                    key={c._id}
                    className={`list-row ${selectedCourse === c._id ? "ring-2 ring-[var(--accent-soft)]" : ""}`}
                  >
                    <button
                      type="button"
                      className="min-w-0 flex-1 text-left"
                      onClick={() => setSelectedCourse(c._id)}
                    >
                      <p className="font-medium">{c.title}</p>
                    </button>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditTarget({ kind: "course", id: c._id, title: c.title });
                          setEditTitle(c.title);
                        }}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => {
                          if (
                            !window.confirm(
                              `Delete course "${c.title}" and all modules/lessons?`,
                            )
                          ) {
                            return;
                          }
                          void removeCourse({ courseId: c._id })
                            .then(() => {
                              if (selectedCourse === c._id) setSelectedCourse("");
                              notify("Course deleted.", "success");
                            })
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

            {structure && structure.course.type === "native" && (
              <Card className="mt-6" padding="md">
                <h3 className="font-display text-base font-semibold">
                  {structure.course.title} — structure
                </h3>
                <div className="mt-4 space-y-4">
                  {structure.modules.map(({ module, lessons }) => (
                    <div
                      key={module._id}
                      className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-2)] p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-medium">{module.title}</p>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEditTarget({
                                kind: "module",
                                id: module._id,
                                title: module.title,
                              });
                              setEditTitle(module.title);
                            }}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => {
                              if (
                                !window.confirm(`Delete module "${module.title}"?`)
                              ) {
                                return;
                              }
                              void removeModule({ moduleId: module._id })
                                .then(() => notify("Module deleted.", "success"))
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
                      <ul className="mt-3 space-y-2 pl-1">
                        {lessons.map((l) => (
                          <li
                            key={l._id}
                            className="flex flex-wrap items-center justify-between gap-2 text-sm"
                          >
                            <span>{l.title}</span>
                            <div className="flex gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setEditTarget({
                                    kind: "lesson",
                                    id: l._id,
                                    title: l.title,
                                  });
                                  setEditTitle(l.title);
                                }}
                              >
                                Edit
                              </Button>
                              <Button
                                variant="danger"
                                size="sm"
                                onClick={() => {
                                  if (!window.confirm(`Delete lesson "${l.title}"?`)) {
                                    return;
                                  }
                                  void removeLesson({ lessonId: l._id })
                                    .then(() => notify("Lesson deleted.", "success"))
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
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>

                <Row gap="md" className="mt-6">
                  <Col span={12} md={6}>
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (!selectedCourse || !moduleTitle.trim()) return;
                        void addModule({
                          courseId: selectedCourse as Id<"courses">,
                          title: moduleTitle.trim(),
                        })
                          .then(() => {
                            setModuleTitle("");
                            notify("Module added.", "success");
                          })
                          .catch((err) =>
                            notify(err instanceof Error ? err.message : "Failed", "error"),
                          );
                      }}
                      className="flex gap-2"
                    >
                      <Input
                        className="flex-1"
                        placeholder="Module title"
                        value={moduleTitle}
                        onChange={(e) => setModuleTitle(e.target.value)}
                      />
                      <Button type="submit" variant="secondary" size="sm">
                        Add module
                      </Button>
                    </form>
                  </Col>
                  {structure.modules[0] && (
                    <Col span={12} md={6}>
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          const modId = structure.modules[0]?.module._id;
                          if (!modId || !lessonTitle.trim()) return;
                          void addLesson({
                            moduleId: modId,
                            title: lessonTitle.trim(),
                          })
                            .then(() => {
                              setLessonTitle("");
                              notify("Lesson added.", "success");
                            })
                            .catch((err) =>
                              notify(
                                err instanceof Error ? err.message : "Failed",
                                "error",
                              ),
                            );
                        }}
                        className="flex gap-2"
                      >
                        <Input
                          className="flex-1"
                          placeholder="Lesson title"
                          value={lessonTitle}
                          onChange={(e) => setLessonTitle(e.target.value)}
                        />
                        <Button type="submit" variant="secondary" size="sm">
                          Add lesson
                        </Button>
                      </form>
                    </Col>
                  )}
                </Row>
              </Card>
            )}
          </Section>

        </>
      )}
      </TabPanel>

      <TabPanel id="subscribers" active={tab === "subscribers"}>
          <Section title="Subscribed families">
            {!academyId ? (
              <EmptyState>Select an academy first.</EmptyState>
            ) : subscribers === undefined ? (
              <p className="text-sm text-[var(--muted)]">Loading…</p>
            ) : subscribers.length === 0 ? (
              <EmptyState>No subscribers yet.</EmptyState>
            ) : (
              <div className="space-y-1.5">
                {subscribers.map((s) => (
                  <div key={s.subscriptionId} className="list-row list-row-dense">
                    <span className="font-medium">{s.familyName}</span>
                    <Badge tone={s.status === "active" ? "success" : "neutral"}>
                      {s.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </Section>
      </TabPanel>

      <Modal
        open={academyModalOpen}
        onClose={() => setAcademyModalOpen(false)}
        title={academyModalMode === "edit" ? "Edit academy" : "Create academy"}
        description={
          academyModalMode === "edit"
            ? "Update your academy profile."
            : "Set up a new academy to publish courses."
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setAcademyModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="academy-form">
              {academyModalMode === "edit" ? "Save profile" : "Create academy"}
            </Button>
          </>
        }
      >
        <form id="academy-form" onSubmit={(e) => void onAcademySubmit(e)} className="space-y-4">
          <Input
            label="Academy name"
            placeholder="Academy name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <Textarea
            label="Description"
            placeholder="Tell families about your academy"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </form>
      </Modal>

      <Modal
        open={courseModalOpen}
        onClose={() => setCourseModalOpen(false)}
        title="Publish native course"
        description="Create a new course under this academy."
        footer={
          <>
            <Button variant="secondary" onClick={() => setCourseModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="course-form">
              Publish course
            </Button>
          </>
        }
      >
        <form id="course-form" onSubmit={(e) => void onCreateCourse(e)} className="space-y-4">
          <Input
            label="Course title"
            placeholder="Course title"
            value={courseTitle}
            onChange={(e) => setCourseTitle(e.target.value)}
            required
          />
          <Select
            label="Subject"
            value={subjectId || subjects?.[0]?._id || ""}
            onChange={(e) => setSubjectId(e.target.value)}
          >
            {(subjects ?? []).map((s) => (
              <option key={s._id} value={s._id}>
                {s.name}
              </option>
            ))}
          </Select>
        </form>
      </Modal>

      <Modal
        open={editTarget !== null}
        onClose={() => {
          setEditTarget(null);
          setEditTitle("");
        }}
        title={
          editTarget?.kind === "course"
            ? "Edit course"
            : editTarget?.kind === "module"
              ? "Edit module"
              : "Edit lesson"
        }
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setEditTarget(null);
                setEditTitle("");
              }}
            >
              Cancel
            </Button>
            <Button type="submit" form="edit-form">
              Save
            </Button>
          </>
        }
      >
        <form id="edit-form" onSubmit={(e) => void onEditSubmit(e)}>
          <Input
            label="Title"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            required
          />
        </form>
      </Modal>
    </div>
  );
}

export default function AcademyDashboardPage() {
  return (
    <Suspense fallback={<p className="text-sm text-[var(--muted)]">Loading…</p>}>
      <AcademyDashboardInner />
    </Suspense>
  );
}
