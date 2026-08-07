"use client";

import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

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
  const bootstrap = useMutation(api.admin.bootstrapSuperAdmin);
  const promote = useMutation(api.admin.promoteToSuperAdmin);
  const seedSubjects = useMutation(api.subjects.seed);
  const [message, setMessage] = useState<string | null>(null);

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
