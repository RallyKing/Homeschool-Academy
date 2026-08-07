"use client";

import { FormEvent, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";

export default function AcademyDashboardPage() {
  const user = useQuery(api.users.current);
  const academies = useQuery(api.academies.myAcademies);
  const createAcademy = useMutation(api.academies.create);
  const [name, setName] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  if (user === undefined) {
    return <p className="text-sm text-neutral-500">Loading…</p>;
  }

  if (!user) {
    return <p className="text-sm">Please sign in.</p>;
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setMessage(null);
    try {
      await createAcademy({ name: name.trim() });
      setName("");
      setMessage("Academy created.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Academy dashboard</h1>
        <p className="text-sm text-neutral-600">
          Teachers manage academy profiles and courses. Families subscribe to
          access content.
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
                {a.name}
              </li>
            ))
          )}
        </ul>
      </section>

      <form onSubmit={(e) => void onCreate(e)} className="flex gap-2">
        <input
          className="flex-1 border border-neutral-300 px-2 py-1.5 text-sm"
          placeholder="Academy name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button
          type="submit"
          className="border border-neutral-900 bg-neutral-900 px-3 py-1.5 text-sm text-white"
        >
          Create
        </button>
      </form>

      {message && <p className="text-sm text-neutral-600">{message}</p>}
    </div>
  );
}
