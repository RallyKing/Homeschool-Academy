"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";

export default function FamilyCoursesPage() {
  const family = useQuery(api.users.myFamily);
  const subjects = useQuery(api.subjects.list);
  const courses = useQuery(api.courses.listForFamily, family ? {} : "skip");
  const seedSubjects = useMutation(api.subjects.seed);
  const createCourse = useMutation(api.courses.create);
  const addModule = useMutation(api.courses.addModule);
  const addLesson = useMutation(api.courses.addLesson);

  const [title, setTitle] = useState("");
  const [type, setType] = useState<"native" | "external">("native");
  const [subjectId, setSubjectId] = useState("");
  const [externalSource, setExternalSource] = useState("");
  const [description, setDescription] = useState("");
  const [selectedCourse, setSelectedCourse] = useState("");
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
      setTitle("");
      setDescription("");
      setExternalSource("");
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
    return <p className="text-sm text-neutral-500">Loading…</p>;
  }

  if (!family) {
    return (
      <p className="text-sm">
        <Link href="/onboarding" className="underline">
          Create a family
        </Link>{" "}
        first.
      </p>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm">
          <Link href="/family/dashboard" className="underline">
            ← Family
          </Link>
        </p>
        <h1 className="mt-2 text-2xl font-semibold">Courses</h1>
        <p className="text-sm text-neutral-600">
          Native curricula (modules/lessons) or external trackers (Zearn-style).
        </p>
      </div>

      <form onSubmit={(e) => void onCreate(e)} className="space-y-3">
        <h2 className="text-lg font-medium">New course</h2>
        <label className="block text-sm">
          Type
          <select
            className="mt-1 w-full border border-neutral-300 px-2 py-1.5"
            value={type}
            onChange={(e) => setType(e.target.value as "native" | "external")}
          >
            <option value="native">Native (modules & lessons)</option>
            <option value="external">External tracker</option>
          </select>
        </label>
        <label className="block text-sm">
          Title
          <input
            className="mt-1 w-full border border-neutral-300 px-2 py-1.5"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </label>
        <label className="block text-sm">
          Subject
          <select
            className="mt-1 w-full border border-neutral-300 px-2 py-1.5"
            value={subjectId || subjects?.[0]?._id || ""}
            onChange={(e) => setSubjectId(e.target.value)}
          >
            {(subjects ?? []).map((s) => (
              <option key={s._id} value={s._id}>
                {s.name} ({s.category})
              </option>
            ))}
          </select>
        </label>
        {type === "external" && (
          <label className="block text-sm">
            External source
            <input
              className="mt-1 w-full border border-neutral-300 px-2 py-1.5"
              placeholder="Zearn, Khan Academy, …"
              value={externalSource}
              onChange={(e) => setExternalSource(e.target.value)}
              required
            />
          </label>
        )}
        <label className="block text-sm">
          Description
          <textarea
            className="mt-1 w-full border border-neutral-300 px-2 py-1.5"
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        <button
          type="submit"
          className="border border-neutral-900 bg-neutral-900 px-3 py-1.5 text-sm text-white"
        >
          Create course
        </button>
        {(!subjects || subjects.length === 0) && (
          <button
            type="button"
            className="ml-2 text-sm underline"
            onClick={() =>
              void seedSubjects()
                .then((r) => setMessage(`Seeded ${r.created} subjects`))
                .catch((err) =>
                  setMessage(err instanceof Error ? err.message : "Failed"),
                )
            }
          >
            Seed subjects
          </button>
        )}
      </form>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">Your courses</h2>
        <ul className="text-sm">
          {courses === undefined ? (
            <li>Loading…</li>
          ) : courses.length === 0 ? (
            <li className="text-neutral-500">None yet.</li>
          ) : (
            courses.map((c) => (
              <li key={c._id} className="border-b border-neutral-100 py-2">
                <button
                  type="button"
                  className={`text-left ${selectedCourse === c._id ? "font-medium underline" : ""}`}
                  onClick={() => setSelectedCourse(c._id)}
                >
                  {c.title} · {c.type}
                  {c.externalSourceName ? ` (${c.externalSourceName})` : ""}
                </button>
              </li>
            ))
          )}
        </ul>
      </section>

      {selectedCourse && structure && (
        <section className="space-y-4 border-t border-neutral-200 pt-4">
          <h2 className="text-lg font-medium">{structure.course.title}</h2>
          {structure.course.type === "native" ? (
            <>
              <ul className="space-y-3 text-sm">
                {structure.modules.length === 0 ? (
                  <li className="text-neutral-500">No modules yet.</li>
                ) : (
                  structure.modules.map(({ module, lessons }) => (
                    <li key={module._id}>
                      <p className="font-medium">{module.title}</p>
                      <ul className="ml-3 list-disc text-neutral-700">
                        {lessons.map((l) => (
                          <li key={l._id}>
                            {l.title}
                            {l.estimatedMinutes
                              ? ` (${l.estimatedMinutes} min)`
                              : ""}
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))
                )}
              </ul>
              <form onSubmit={(e) => void onAddModule(e)} className="flex gap-2">
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
              {structure.modules.length > 0 && (
                <form
                  onSubmit={(e) => void onAddLesson(e)}
                  className="space-y-2"
                >
                  <select
                    className="w-full border border-neutral-300 px-2 py-1.5 text-sm"
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
                  </select>
                  <div className="flex gap-2">
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
                  </div>
                </form>
              )}
            </>
          ) : (
            <p className="text-sm text-neutral-600">
              External tracker — log time against this course in the ledger.
            </p>
          )}
        </section>
      )}

      {message && <p className="text-sm text-neutral-600">{message}</p>}
    </div>
  );
}
