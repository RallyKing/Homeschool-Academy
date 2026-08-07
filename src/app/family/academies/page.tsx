"use client";

import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";

export default function FamilyAcademiesPage() {
  const family = useQuery(api.users.myFamily);
  const academies = useQuery(api.academies.listBrowsable);
  const subscriptions = useQuery(api.academies.mySubscriptions);
  const subscribe = useMutation(api.academies.subscribeFamily);
  const unsubscribe = useMutation(api.academies.unsubscribeFamily);
  const [message, setMessage] = useState<string | null>(null);

  const subscribedIds = new Set(
    subscriptions?.map((s) => s.academy._id) ?? [],
  );

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
        <h1 className="mt-2 text-2xl font-semibold">Academies</h1>
        <p className="text-sm text-neutral-600">
          Opt in to teacher academies to use their published courses.
        </p>
      </div>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">Active subscriptions</h2>
        <ul className="text-sm">
          {subscriptions === undefined ? (
            <li>Loading…</li>
          ) : subscriptions.length === 0 ? (
            <li className="text-neutral-500">None yet.</li>
          ) : (
            subscriptions.map(({ academy, subscription }) => (
              <li
                key={subscription._id}
                className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-100 py-2"
              >
                <span>
                  {academy.name}
                  {academy.description ? ` — ${academy.description}` : ""}
                </span>
                <button
                  type="button"
                  className="text-xs underline"
                  onClick={() =>
                    void unsubscribe({ academyId: academy._id })
                      .then(() => setMessage("Unsubscribed."))
                      .catch((err) =>
                        setMessage(
                          err instanceof Error ? err.message : "Failed",
                        ),
                      )
                  }
                >
                  Unsubscribe
                </button>
              </li>
            ))
          )}
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">Browse academies</h2>
        <ul className="text-sm">
          {academies === undefined ? (
            <li>Loading…</li>
          ) : academies.length === 0 ? (
            <li className="text-neutral-500">
              No academies published yet. Teachers create them from the academy
              dashboard.
            </li>
          ) : (
            academies.map((a) => (
              <li
                key={a._id}
                className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-100 py-2"
              >
                <div>
                  <p className="font-medium">{a.name}</p>
                  {a.description && (
                    <p className="text-neutral-600">{a.description}</p>
                  )}
                </div>
                {subscribedIds.has(a._id) ? (
                  <span className="text-xs text-neutral-500">Subscribed</span>
                ) : (
                  <button
                    type="button"
                    className="border border-neutral-900 bg-neutral-900 px-2 py-1 text-xs text-white"
                    onClick={() =>
                      void subscribe({
                        academyId: a._id as Id<"academies">,
                      })
                        .then(() => setMessage(`Subscribed to ${a.name}`))
                        .catch((err) =>
                          setMessage(
                            err instanceof Error ? err.message : "Failed",
                          ),
                        )
                    }
                  >
                    Subscribe
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
