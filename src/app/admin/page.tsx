"use client";

import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "../../../convex/_generated/api";

export default function AdminPage() {
  const user = useQuery(api.users.current);
  const users = useQuery(
    api.admin.listUsers,
    user?.role === "superAdmin" ? {} : "skip",
  );
  const bootstrap = useMutation(api.admin.bootstrapSuperAdmin);
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
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">God Mode / SuperAdmin</h1>
      <p className="text-sm text-neutral-600">Platform administration.</p>

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
        <h2 className="mb-2 text-lg font-medium">Users</h2>
        <ul className="space-y-1 text-sm">
          {users === undefined ? (
            <li>Loading…</li>
          ) : (
            users.map((u) => (
              <li key={u._id} className="border-b border-neutral-100 py-1">
                {u.email ?? u.name ?? u._id} · {u.role ?? "unset"}
              </li>
            ))
          )}
        </ul>
      </section>

      {message && <p className="text-sm text-neutral-600">{message}</p>}
    </div>
  );
}
