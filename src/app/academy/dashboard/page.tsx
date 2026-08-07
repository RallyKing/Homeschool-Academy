"use client";

import { FormEvent, useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";

export default function AcademyDashboardPage() {
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

  useEffect(() => {
    if (status?.needsOnboarding) {
      router.replace("/onboarding");
    }
  }, [status, router]);

  const academyId = (selectedAcademy || academies?.[0]?._id || "") as
    | Id<"academies">
    | "";

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

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setMessage(null);
    try {
      const id = await createAcademy({
        name: name.trim(),
        description: description.trim() || undefined,
      });
      setName("");
      setDescription("");
      setSelectedAcademy(id);
      setMessage("Academy created.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed");
    }
  }

  async function onUpdate(e: FormEvent) {
    e.preventDefault();
    if (!academyId) return;
    try {
      await updateAcademy({
        academyId,
        name: name.trim() || undefined,
        description: description.trim() || undefined,
      });
      setMessage("Academy updated.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed");
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
        setMessage("Seed subjects first.");
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
      setMessage("Course published.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed");
    }
  }

  if (user === undefined) {
    return <p className="text-sm text-neutral-500">Loading…</p>;
  }

  if (!user) {
    return <p className="text-sm">Please sign in.</p>;
  }

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold">Academy</h1>
        <p className="text-sm text-neutral-600">
          Publish courses and see which families have subscribed.
        </p>
      </div>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">My academies</h2>
        <ul className="text-sm">
          {academies === undefined ? (
            <li>Loading…</li>
          ) : academies.length === 0 ? (
            <li className="text-neutral-500">No academies yet.</li>
          ) : (
            academies.map((a) => (
              <li key={a._id} className="border-b border-neutral-100 py-1">
                <button
                  type="button"
                  className={
                    academyId === a._id ? "font-medium underline" : ""
                  }
                  onClick={() => setSelectedAcademy(a._id)}
                >
                  {a.name}
                </button>
                {a.description ? ` — ${a.description}` : ""}
              </li>
            ))
          )}
        </ul>
      </section>

      <form
        onSubmit={(e) => void (academyId ? onUpdate(e) : onCreate(e))}
        className="space-y-2"
      >
        <h2 className="text-lg font-medium">
          {academyId ? "Update profile" : "Create academy"}
        </h2>
        <input
          className="w-full border border-neutral-300 px-2 py-1.5 text-sm"
          placeholder="Academy name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <textarea
          className="w-full border border-neutral-300 px-2 py-1.5 text-sm"
          placeholder="Description"
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <button
          type="submit"
          className="border border-neutral-900 bg-neutral-900 px-3 py-1.5 text-sm text-white"
        >
          {academyId ? "Save profile" : "Create"}
        </button>
        {academyId && (
          <button
            type="button"
            className="ml-2 border border-red-700 px-3 py-1.5 text-sm text-red-700"
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
                  setMessage("Academy deleted.");
                })
                .catch((err) =>
                  setMessage(err instanceof Error ? err.message : "Failed"),
                );
            }}
          >
            Delete academy
          </button>
        )}
      </form>

      {academyId && (
        <>
          <section className="space-y-3">
            <h2 className="text-lg font-medium">Publish native course</h2>
            <form onSubmit={(e) => void onCreateCourse(e)} className="space-y-2">
              <input
                className="w-full border border-neutral-300 px-2 py-1.5 text-sm"
                placeholder="Course title"
                value={courseTitle}
                onChange={(e) => setCourseTitle(e.target.value)}
                required
              />
              <select
                className="w-full border border-neutral-300 px-2 py-1.5 text-sm"
                value={subjectId || subjects?.[0]?._id || ""}
                onChange={(e) => setSubjectId(e.target.value)}
              >
                {(subjects ?? []).map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                className="border border-neutral-400 px-3 py-1.5 text-sm"
              >
                Publish course
              </button>
            </form>

            <ul className="text-sm">
              {(courses ?? []).map((c) => (
                <li
                  key={c._id}
                  className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-100 py-1"
                >
                  <button
                    type="button"
                    className={
                      selectedCourse === c._id ? "font-medium underline" : ""
                    }
                    onClick={() => setSelectedCourse(c._id)}
                  >
                    {c.title}
                  </button>
                  <span className="flex gap-3 text-xs">
                    <button
                      type="button"
                      className="underline"
                      onClick={() => {
                        const next = window.prompt("Course title", c.title);
                        if (!next?.trim()) return;
                        void updateCourse({
                          courseId: c._id,
                          title: next.trim(),
                        })
                          .then(() => setMessage("Course updated."))
                          .catch((err) =>
                            setMessage(
                              err instanceof Error ? err.message : "Failed",
                            ),
                          );
                      }}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="underline text-red-700"
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
                    </button>
                  </span>
                </li>
              ))}
            </ul>

            {structure && structure.course.type === "native" && (
              <div className="space-y-3 border-t border-neutral-200 pt-3">
                <ul className="text-sm">
                  {structure.modules.map(({ module, lessons }) => (
                    <li key={module._id} className="mb-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{module.title}</p>
                        <button
                          type="button"
                          className="text-xs underline"
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
                        </button>
                        <button
                          type="button"
                          className="text-xs underline text-red-700"
                          onClick={() => {
                            if (
                              !window.confirm(
                                `Delete module "${module.title}"?`,
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
                        </button>
                      </div>
                      <ul className="ml-3 list-disc">
                        {lessons.map((l) => (
                          <li key={l._id} className="flex flex-wrap gap-2">
                            <span>{l.title}</span>
                            <button
                              type="button"
                              className="text-xs underline"
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
                            </button>
                            <button
                              type="button"
                              className="text-xs underline text-red-700"
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
                            </button>
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
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
                        setMessage("Module added.");
                      })
                      .catch((err) =>
                        setMessage(
                          err instanceof Error ? err.message : "Failed",
                        ),
                      );
                  }}
                  className="flex gap-2"
                >
                  <input
                    className="flex-1 border border-neutral-300 px-2 py-1.5 text-sm"
                    placeholder="Module title"
                    value={moduleTitle}
                    onChange={(e) => setModuleTitle(e.target.value)}
                  />
                  <button
                    type="submit"
                    className="border border-neutral-400 px-3 py-1.5 text-sm"
                  >
                    Add module
                  </button>
                </form>
                {structure.modules[0] && (
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
                          setMessage("Lesson added.");
                        })
                        .catch((err) =>
                          setMessage(
                            err instanceof Error ? err.message : "Failed",
                          ),
                        );
                    }}
                    className="flex gap-2"
                  >
                    <input
                      className="flex-1 border border-neutral-300 px-2 py-1.5 text-sm"
                      placeholder="Lesson title"
                      value={lessonTitle}
                      onChange={(e) => setLessonTitle(e.target.value)}
                    />
                    <button
                      type="submit"
                      className="border border-neutral-400 px-3 py-1.5 text-sm"
                    >
                      Add lesson
                    </button>
                  </form>
                )}
              </div>
            )}
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-medium">Subscribed families</h2>
            <ul className="text-sm">
              {subscribers === undefined ? (
                <li>Loading…</li>
              ) : subscribers.length === 0 ? (
                <li className="text-neutral-500">No subscribers yet.</li>
              ) : (
                subscribers.map((s) => (
                  <li
                    key={s.subscriptionId}
                    className="border-b border-neutral-100 py-1"
                  >
                    {s.familyName} · {s.status}
                  </li>
                ))
              )}
            </ul>
          </section>
        </>
      )}

      {message && <p className="text-sm text-neutral-600">{message}</p>}
    </div>
  );
}
