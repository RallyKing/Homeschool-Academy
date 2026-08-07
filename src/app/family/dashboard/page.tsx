"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";

export default function FamilyDashboardPage() {
  const user = useQuery(api.users.current);
  const status = useQuery(api.users.onboardingStatus);
  const family = useQuery(api.users.myFamily);
  const students = useQuery(api.students.listForMyFamily);
  const ensureFamily = useMutation(api.families.ensureMine);
  const updateFamily = useMutation(api.families.update);
  const createStudent = useMutation(api.students.create);
  const updateStudent = useMutation(api.students.update);
  const linkByEmail = useMutation(api.students.linkByEmail);
  const seedSubjects = useMutation(api.subjects.seed);
  const router = useRouter();

  const [name, setName] = useState("");
  const [level, setLevel] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [familyNameEdit, setFamilyNameEdit] = useState("");
  const [linkEmail, setLinkEmail] = useState("");
  const [linkStudentId, setLinkStudentId] = useState("");
  const [editStudentId, setEditStudentId] = useState<string>("");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (status?.needsOnboarding) {
      router.replace("/onboarding");
    }
  }, [status, router]);

  useEffect(() => {
    if (family?.name) setFamilyNameEdit(family.name);
  }, [family?.name]);

  if (user === undefined) {
    return <p className="text-sm text-neutral-500">Loading…</p>;
  }

  if (!user) {
    return <p className="text-sm">Please sign in.</p>;
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
    try {
      await updateFamily({ familyId: family._id, name: familyNameEdit });
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
      setName("");
      setLevel("");
      setBirthYear("");
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
      setEditStudentId("");
      setName("");
      setLevel("");
      setBirthYear("");
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
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold">Family</h1>
        <p className="text-sm text-neutral-600">
          {family
            ? family.name
            : "No family yet — create one to manage students."}
        </p>
        {!family && (
          <button
            type="button"
            onClick={() => void setupFamily()}
            className="mt-2 border border-neutral-900 bg-neutral-900 px-3 py-1.5 text-sm text-white"
          >
            Create family
          </button>
        )}
        {family && (
          <form
            onSubmit={(e) => void onRenameFamily(e)}
            className="mt-3 flex flex-wrap gap-2"
          >
            <input
              className="min-w-[12rem] flex-1 border border-neutral-300 px-2 py-1.5 text-sm"
              value={familyNameEdit}
              onChange={(e) => setFamilyNameEdit(e.target.value)}
            />
            <button
              type="submit"
              className="border border-neutral-400 px-3 py-1.5 text-sm"
            >
              Rename
            </button>
          </form>
        )}
      </div>

      <nav className="flex flex-wrap gap-3 text-sm">
        <Link href="/family/courses" className="underline">
          Courses
        </Link>
        <Link href="/family/academies" className="underline">
          Academies
        </Link>
        <Link href="/family/planner" className="underline">
          Planner
        </Link>
        <Link href="/family/ledger" className="underline">
          Ledger
        </Link>
        <Link href="/family/progress" className="underline">
          Progress
        </Link>
        <Link href="/family/ai" className="underline">
          AI guardrails
        </Link>
      </nav>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Students</h2>
        <ul className="text-sm text-neutral-700">
          {students === undefined ? (
            <li>Loading…</li>
          ) : students.length === 0 ? (
            <li className="text-neutral-500">No students yet — add one below.</li>
          ) : (
            students.map((s) => (
              <li
                key={s._id}
                className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-100 py-2"
              >
                <span>
                  {s.displayName}
                  {s.academicLevel ? ` · ${s.academicLevel}` : ""}
                  {s.birthYear ? ` · born ${s.birthYear}` : ""}
                  {s.userId ? " · linked" : ""}
                </span>
                <button
                  type="button"
                  className="text-xs underline"
                  onClick={() => {
                    setEditStudentId(s._id);
                    setName(s.displayName);
                    setLevel(s.academicLevel ?? "");
                    setBirthYear(s.birthYear ? String(s.birthYear) : "");
                  }}
                >
                  Edit
                </button>
              </li>
            ))
          )}
        </ul>

        <form
          onSubmit={(e) =>
            void (editStudentId ? onSaveStudent(e) : onAddStudent(e))
          }
          className="space-y-2"
        >
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              className="flex-1 border border-neutral-300 px-2 py-1.5 text-sm"
              placeholder="Student name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required={!editStudentId}
            />
            <input
              className="sm:w-28 border border-neutral-300 px-2 py-1.5 text-sm"
              placeholder="Level"
              value={level}
              onChange={(e) => setLevel(e.target.value)}
            />
            <input
              className="sm:w-28 border border-neutral-300 px-2 py-1.5 text-sm"
              placeholder="Birth year"
              type="number"
              value={birthYear}
              onChange={(e) => setBirthYear(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              className="border border-neutral-900 bg-neutral-900 px-3 py-1.5 text-sm text-white"
            >
              {editStudentId ? "Save student" : "Add student"}
            </button>
            {editStudentId && (
              <button
                type="button"
                className="border border-neutral-400 px-3 py-1.5 text-sm"
                onClick={() => {
                  setEditStudentId("");
                  setName("");
                  setLevel("");
                  setBirthYear("");
                }}
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </section>

      {students && students.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-medium">Link student login</h2>
          <p className="text-sm text-neutral-600">
            After the student signs up with their email, link them here.
          </p>
          <form onSubmit={(e) => void onLink(e)} className="space-y-2">
            <select
              className="w-full border border-neutral-300 px-2 py-1.5 text-sm"
              value={linkStudentId || students[0]?._id || ""}
              onChange={(e) => setLinkStudentId(e.target.value)}
            >
              {students.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.displayName}
                </option>
              ))}
            </select>
            <div className="flex gap-2">
              <input
                type="email"
                className="flex-1 border border-neutral-300 px-2 py-1.5 text-sm"
                placeholder="student@email.com"
                value={linkEmail}
                onChange={(e) => setLinkEmail(e.target.value)}
                required
              />
              <button
                type="submit"
                className="border border-neutral-400 px-3 py-1.5 text-sm"
              >
                Link
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="border-t border-neutral-200 pt-4">
        <p className="text-sm text-neutral-600">
          Next:{" "}
          <Link href="/family/courses" className="underline">
            add courses
          </Link>
          ,{" "}
          <Link href="/family/planner" className="underline">
            plan a week
          </Link>
          , then{" "}
          <Link href="/family/ledger" className="underline">
            log learning time
          </Link>
          .
        </p>
        <button
          type="button"
          className="mt-2 text-sm underline text-neutral-600"
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
        </button>
      </section>

      {message && <p className="text-sm text-neutral-600">{message}</p>}
    </div>
  );
}
