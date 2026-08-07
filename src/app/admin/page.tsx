"use client";

import { FormEvent, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

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
  const [subjectName, setSubjectName] = useState("");
  const [subjectCategory, setSubjectCategory] =
    useState<SubjectCategory>("stem");
  const [editSubjectId, setEditSubjectId] = useState("");

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
        setEditSubjectId("");
        setMessage("Subject updated.");
      } else {
        await createSubject({
          name: subjectName.trim(),
          category: subjectCategory,
        });
        setMessage("Subject created.");
      }
      setSubjectName("");
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

  if (user.role !== "superAdmin") {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Admin</h1>
        <p className="text-sm text-neutral-600">
          SuperAdmin access required. If this is a fresh deployment with no
          admin yet, claim God Mode once:
        </p>
        <button
          type="button"
          className="border border-neutral-900 bg-neutral-900 px-3 py-1.5 text-sm text-white"
          onClick={() =>
            void bootstrap()
              .then(() => setMessage("You are now superAdmin. Refresh."))
              .catch((err) =>
                setMessage(err instanceof Error ? err.message : "Failed"),
              )
          }
        >
          Bootstrap superAdmin
        </button>
        {message && <p className="text-sm text-neutral-600">{message}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">God Mode</h1>
      <p className="text-sm text-neutral-600">Platform overview.</p>

      {overview && (
        <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-neutral-500">Users</dt>
            <dd className="text-xl font-semibold">{overview.userCount}</dd>
          </div>
          <div>
            <dt className="text-neutral-500">Families</dt>
            <dd className="text-xl font-semibold">{overview.familyCount}</dd>
          </div>
          <div>
            <dt className="text-neutral-500">Academies</dt>
            <dd className="text-xl font-semibold">{overview.academyCount}</dd>
          </div>
          <div>
            <dt className="text-neutral-500">Students</dt>
            <dd className="text-xl font-semibold">{overview.studentCount}</dd>
          </div>
          <div>
            <dt className="text-neutral-500">Courses</dt>
            <dd className="text-xl font-semibold">{overview.courseCount}</dd>
          </div>
          <div>
            <dt className="text-neutral-500">Logs</dt>
            <dd className="text-xl font-semibold">{overview.logCount}</dd>
          </div>
          <div>
            <dt className="text-neutral-500">Subjects</dt>
            <dd className="text-xl font-semibold">{overview.subjectCount}</dd>
          </div>
        </dl>
      )}

      {overview && (
        <p className="text-sm text-neutral-600">
          Roles — admin {overview.usersByRole.superAdmin}, parent{" "}
          {overview.usersByRole.parent}, teacher {overview.usersByRole.teacher},
          student {overview.usersByRole.student}, unset{" "}
          {overview.usersByRole.unset}
        </p>
      )}

      <button
        type="button"
        className="border border-neutral-400 px-3 py-1.5 text-sm"
        onClick={() =>
          void seedSubjects()
            .then((r) =>
              setMessage(`Subjects: ${r.created} created / ${r.total} total`),
            )
            .catch((err) =>
              setMessage(err instanceof Error ? err.message : "Failed"),
            )
        }
      >
        Seed subjects
      </button>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Subjects</h2>
        <form onSubmit={(e) => void onSubjectSubmit(e)} className="flex flex-wrap gap-2">
          <input
            className="border border-neutral-300 px-2 py-1.5 text-sm"
            placeholder="Subject name"
            value={subjectName}
            onChange={(e) => setSubjectName(e.target.value)}
            required
          />
          <select
            className="border border-neutral-300 px-2 py-1.5 text-sm"
            value={subjectCategory}
            onChange={(e) =>
              setSubjectCategory(e.target.value as SubjectCategory)
            }
          >
            <option value="stem">stem</option>
            <option value="humanities">humanities</option>
            <option value="life">life</option>
            <option value="applied">applied</option>
          </select>
          <button
            type="submit"
            className="border border-neutral-900 bg-neutral-900 px-3 py-1.5 text-sm text-white"
          >
            {editSubjectId ? "Save subject" : "Add subject"}
          </button>
          {editSubjectId && (
            <button
              type="button"
              className="border border-neutral-400 px-3 py-1.5 text-sm"
              onClick={() => {
                setEditSubjectId("");
                setSubjectName("");
              }}
            >
              Cancel
            </button>
          )}
        </form>
        <ul className="space-y-1 text-sm">
          {subjects === undefined ? (
            <li>Loading…</li>
          ) : subjects.length === 0 ? (
            <li className="text-neutral-500">None</li>
          ) : (
            subjects.map((s) => (
              <li
                key={s._id}
                className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-100 py-1"
              >
                <span>
                  {s.name} · {s.category}
                </span>
                <span className="flex gap-3 text-xs">
                  <button
                    type="button"
                    className="underline"
                    onClick={() => {
                      setEditSubjectId(s._id);
                      setSubjectName(s.name);
                      setSubjectCategory(s.category);
                    }}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="underline text-red-700"
                    onClick={() => {
                      if (!window.confirm(`Delete subject "${s.name}"?`)) {
                        return;
                      }
                      void removeSubject({ subjectId: s._id })
                        .then(() => setMessage("Subject deleted."))
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
            ))
          )}
        </ul>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-medium">Families</h2>
        <ul className="space-y-1 text-sm">
          {families === undefined ? (
            <li>Loading…</li>
          ) : families.length === 0 ? (
            <li className="text-neutral-500">None</li>
          ) : (
            families.map((f) => (
              <li key={f._id} className="border-b border-neutral-100 py-1">
                {f.name}
              </li>
            ))
          )}
        </ul>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-medium">Academies</h2>
        <ul className="space-y-1 text-sm">
          {academies === undefined ? (
            <li>Loading…</li>
          ) : academies.length === 0 ? (
            <li className="text-neutral-500">None</li>
          ) : (
            academies.map((a) => (
              <li key={a._id} className="border-b border-neutral-100 py-1">
                {a.name}
              </li>
            ))
          )}
        </ul>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-medium">Users</h2>
        <ul className="space-y-1 text-sm">
          {users === undefined ? (
            <li>Loading…</li>
          ) : (
            users.map((u) => (
              <li
                key={u._id}
                className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-100 py-1"
              >
                <span>
                  {u.email ?? u.name ?? u._id} · {u.role ?? "unset"}
                </span>
                {u.role !== "superAdmin" && (
                  <button
                    type="button"
                    className="text-xs underline"
                    onClick={() =>
                      void promote({ userId: u._id as Id<"users"> })
                        .then(() => setMessage(`Promoted ${u.email}`))
                        .catch((err) =>
                          setMessage(
                            err instanceof Error ? err.message : "Failed",
                          ),
                        )
                    }
                  >
                    Promote
                  </button>
                )}
              </li>
            ))
          )}
        </ul>
      </section>

      {message && <p className="text-sm text-neutral-600">{message}</p>}
    </div>
  );
}
