"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useMutation, useQuery } from "convex/react";
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
  EmptyState,
  Message,
  Row,
  Col,
} from "@/components/ui";

export default function FamilyCoursesPage() {
  const family = useQuery(api.users.myFamily);
  const subjects = useQuery(api.subjects.list);
  const courses = useQuery(api.courses.listForFamily, family ? {} : "skip");
  const seedSubjects = useMutation(api.subjects.seed);
  const createCourse = useMutation(api.courses.create);
  const updateCourse = useMutation(api.courses.update);
  const removeCourse = useMutation(api.courses.remove);
  const addModule = useMutation(api.courses.addModule);
  const updateModule = useMutation(api.courses.updateModule);
  const removeModule = useMutation(api.courses.removeModule);
  const addLesson = useMutation(api.courses.addLesson);
  const updateLesson = useMutation(api.courses.updateLesson);
  const removeLesson = useMutation(api.courses.removeLesson);

  const [title, setTitle] = useState("");
  const [type, setType] = useState<"native" | "external">("native");
  const [subjectId, setSubjectId] = useState("");
  const [externalSource, setExternalSource] = useState("");
  const [description, setDescription] = useState("");
  const [selectedCourse, setSelectedCourse] = useState("");
  const [courseModalOpen, setCourseModalOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState(false);
  const [moduleTitle, setModuleTitle] = useState("");
  const [lessonTitle, setLessonTitle] = useState("");
  const [lessonModuleId, setLessonModuleId] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const structure = useQuery(
    api.courses.getStructure,
    selectedCourse
      ? { courseId: selectedCourse as Id<"courses"> }
      : "skip",
  );

  function resetCourseForm() {
    setTitle("");
    setType("native");
    setSubjectId("");
    setExternalSource("");
    setDescription("");
    setEditingCourse(false);
  }

  function openCreateModal() {
    resetCourseForm();
    setCourseModalOpen(true);
  }

  function openEditModal(c: {
    _id: Id<"courses">;
    title: string;
    type: "native" | "external";
    subjectId: Id<"subjects">;
    description?: string;
    externalSourceName?: string;
  }) {
    setSelectedCourse(c._id);
    setEditingCourse(true);
    setTitle(c.title);
    setType(c.type);
    setSubjectId(c.subjectId);
    setDescription(c.description ?? "");
    setExternalSource(c.externalSourceName ?? "");
    setCourseModalOpen(true);
  }

  function closeCourseModal() {
    setCourseModalOpen(false);
    if (!editingCourse) resetCourseForm();
    else setEditingCourse(false);
  }

  async function ensureSubjects() {
    if (subjects && subjects.length === 0) {
      await seedSubjects({});
    }
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setMessage(null);
    try {
      await ensureSubjects();
      const sid = (subjectId || subjects?.[0]?._id) as Id<"subjects"> | undefined;
      if (!sid) {
        setMessage("Seed subjects first.");
        return;
      }
      if (editingCourse && selectedCourse) {
        await updateCourse({
          courseId: selectedCourse as Id<"courses">,
          title: title.trim(),
          description: description.trim() || undefined,
          subjectId: sid,
          externalSourceName:
            type === "external" ? externalSource.trim() : undefined,
        });
        closeCourseModal();
        resetCourseForm();
        setMessage("Course updated.");
        return;
      }
      const id = await createCourse({
        type,
        title: title.trim(),
        description: description.trim() || undefined,
        subjectId: sid,
        ownerType: "family",
        familyId: family?._id,
        externalSourceName:
          type === "external" ? externalSource.trim() : undefined,
      });
      closeCourseModal();
      resetCourseForm();
      setSelectedCourse(id);
      setMessage("Course created.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed");
    }
  }

  async function onAddModule(e: FormEvent) {
    e.preventDefault();
    if (!selectedCourse || !moduleTitle.trim()) return;
    try {
      const modId = await addModule({
        courseId: selectedCourse as Id<"courses">,
        title: moduleTitle.trim(),
      });
      setModuleTitle("");
      setLessonModuleId(modId);
      setMessage("Module added.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed");
    }
  }

  async function onAddLesson(e: FormEvent) {
    e.preventDefault();
    const modId =
      lessonModuleId || structure?.modules[0]?.module._id || "";
    if (!modId || !lessonTitle.trim()) return;
    try {
      await addLesson({
        moduleId: modId as Id<"modules">,
        title: lessonTitle.trim(),
        estimatedMinutes: 30,
      });
      setLessonTitle("");
      setMessage("Lesson added.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed");
    }
  }

  if (family === undefined) {
    return <p className="text-sm text-[var(--muted)]">Loading…</p>;
  }

  if (!family) {
    return (
      <div className="space-y-4">
        <Link href="/onboarding">
          <Button variant="ghost" size="sm">
            Create a family
          </Button>
        </Link>
        <p className="text-sm text-[var(--muted)]">
          Set up your family before adding courses.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <Link href="/family/dashboard">
        <Button variant="ghost" size="sm">
          ← Family
        </Button>
      </Link>

      <PageHeader
        title="Courses"
        description="Native curricula (modules/lessons) or external trackers (Zearn-style)."
        actions={
          <Button size="sm" onClick={openCreateModal}>
            New course
          </Button>
        }
      />

      <Section title="Your courses">
        {courses === undefined ? (
          <p className="text-sm text-[var(--muted)]">Loading…</p>
        ) : courses.length === 0 ? (
          <EmptyState>No courses yet — create one to get started.</EmptyState>
        ) : (
          <ul className="space-y-2">
            {courses.map((c) => (
              <li key={c._id} className="list-row">
                <button
                  type="button"
                  className={`min-w-0 text-left text-sm ${selectedCourse === c._id ? "font-semibold text-[var(--accent)]" : "text-[var(--foreground)]"}`}
                  onClick={() => setSelectedCourse(c._id)}
                >
                  {c.title} · {c.type}
                  {c.externalSourceName ? ` (${c.externalSourceName})` : ""}
                </button>
                <span className="flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => openEditModal(c)}
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
                          if (selectedCourse === c._id) {
                            setSelectedCourse("");
                          }
                          setMessage("Course deleted.");
                        })
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

      {selectedCourse && structure && (
        <Section title={structure.course.title}>
          {structure.course.type === "native" ? (
            <>
              {structure.modules.length === 0 ? (
                <EmptyState>No modules yet — add one below.</EmptyState>
              ) : (
                <ul className="space-y-3">
                  {structure.modules.map(({ module, lessons }) => (
                    <li key={module._id}>
                      <Card padding="sm">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-medium text-[var(--foreground)]">
                            {module.title}
                          </p>
                          <span className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                const next = window.prompt(
                                  "Module title",
                                  module.title,
                                );
                                if (!next?.trim()) return;
                                void updateModule({
                                  moduleId: module._id,
                                  title: next.trim(),
                                })
                                  .then(() => setMessage("Module updated."))
                                  .catch((err) =>
                                    setMessage(
                                      err instanceof Error ? err.message : "Failed",
                                    ),
                                  );
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
                                    `Delete module "${module.title}" and its lessons?`,
                                  )
                                ) {
                                  return;
                                }
                                void removeModule({ moduleId: module._id })
                                  .then(() => setMessage("Module deleted."))
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
                        </div>
                        {lessons.length > 0 && (
                          <ul className="mt-3 space-y-2 border-t border-[var(--border)] pt-3">
                            {lessons.map((l) => (
                              <li
                                key={l._id}
                                className="flex flex-wrap items-center justify-between gap-2 text-sm text-[var(--muted)]"
                              >
                                <span>
                                  {l.title}
                                  {l.estimatedMinutes
                                    ? ` (${l.estimatedMinutes} min)`
                                    : ""}
                                </span>
                                <span className="flex gap-2">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      const next = window.prompt(
                                        "Lesson title",
                                        l.title,
                                      );
                                      if (!next?.trim()) return;
                                      void updateLesson({
                                        lessonId: l._id,
                                        title: next.trim(),
                                      })
                                        .then(() => setMessage("Lesson updated."))
                                        .catch((err) =>
                                          setMessage(
                                            err instanceof Error
                                              ? err.message
                                              : "Failed",
                                          ),
                                        );
                                    }}
                                  >
                                    Edit
                                  </Button>
                                  <Button
                                    variant="danger"
                                    size="sm"
                                    onClick={() => {
                                      if (
                                        !window.confirm(`Delete lesson "${l.title}"?`)
                                      ) {
                                        return;
                                      }
                                      void removeLesson({ lessonId: l._id })
                                        .then(() => setMessage("Lesson deleted."))
                                        .catch((err) =>
                                          setMessage(
                                            err instanceof Error
                                              ? err.message
                                              : "Failed",
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
                      </Card>
                    </li>
                  ))}
                </ul>
              )}
              <Card>
                <form onSubmit={(e) => void onAddModule(e)} className="flex flex-wrap gap-3">
                  <div className="min-w-[12rem] flex-1">
                    <Input
                      label="New module"
                      placeholder="Module title"
                      value={moduleTitle}
                      onChange={(e) => setModuleTitle(e.target.value)}
                    />
                  </div>
                  <div className="flex items-end">
                    <Button type="submit" variant="secondary">
                      Add module
                    </Button>
                  </div>
                </form>
              </Card>
              {structure.modules.length > 0 && (
                <Card>
                  <form
                    onSubmit={(e) => void onAddLesson(e)}
                    className="space-y-4"
                  >
                    <Select
                      label="Module"
                      value={
                        lessonModuleId || structure.modules[0]?.module._id || ""
                      }
                      onChange={(e) => setLessonModuleId(e.target.value)}
                    >
                      {structure.modules.map(({ module }) => (
                        <option key={module._id} value={module._id}>
                          {module.title}
                        </option>
                      ))}
                    </Select>
                    <Row gap="sm">
                      <Col span={12} md={8}>
                        <Input
                          label="Lesson title"
                          placeholder="Lesson title"
                          value={lessonTitle}
                          onChange={(e) => setLessonTitle(e.target.value)}
                        />
                      </Col>
                      <Col span={12} md={4} className="flex items-end">
                        <Button type="submit" variant="secondary" className="w-full md:w-auto">
                          Add lesson
                        </Button>
                      </Col>
                    </Row>
                  </form>
                </Card>
              )}
            </>
          ) : (
            <Card>
              <p className="text-sm text-[var(--muted)]">
                External tracker — log time against this course in the ledger.
              </p>
            </Card>
          )}
        </Section>
      )}

      <Message tone="success">{message}</Message>

      <Modal
        open={courseModalOpen}
        onClose={closeCourseModal}
        title={editingCourse ? "Edit course" : "New course"}
        description={
          editingCourse
            ? "Update course details."
            : "Create a native curriculum or external tracker."
        }
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={closeCourseModal}>
              Cancel
            </Button>
            {(!subjects || subjects.length === 0) && !editingCourse && (
              <Button
                variant="secondary"
                onClick={() =>
                  void seedSubjects()
                    .then((r) => setMessage(`Seeded ${r.created} subjects`))
                    .catch((err) =>
                      setMessage(err instanceof Error ? err.message : "Failed"),
                    )
                }
              >
                Seed subjects
              </Button>
            )}
            <Button type="submit" form="course-form">
              {editingCourse ? "Save course" : "Create course"}
            </Button>
          </>
        }
      >
        <form id="course-form" onSubmit={(e) => void onCreate(e)} className="space-y-4">
          {!editingCourse && (
            <Select
              label="Type"
              value={type}
              onChange={(e) => setType(e.target.value as "native" | "external")}
            >
              <option value="native">Native (modules & lessons)</option>
              <option value="external">External tracker</option>
            </Select>
          )}
          <Input
            label="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
          <Select
            label="Subject"
            value={subjectId || subjects?.[0]?._id || ""}
            onChange={(e) => setSubjectId(e.target.value)}
          >
            {(subjects ?? []).map((s) => (
              <option key={s._id} value={s._id}>
                {s.name} ({s.category})
              </option>
            ))}
          </Select>
          {type === "external" && (
            <Input
              label="External source"
              placeholder="Zearn, Khan Academy, …"
              value={externalSource}
              onChange={(e) => setExternalSource(e.target.value)}
              required
            />
          )}
          <Textarea
            label="Description"
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </form>
      </Modal>
    </div>
  );
}
