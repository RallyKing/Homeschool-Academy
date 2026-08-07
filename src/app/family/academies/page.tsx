"use client";

import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import {
  Button,
  Section,
  PageHeader,
  Badge,
  EmptyState,
  Message,
} from "@/components/ui";

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
          Set up your family before browsing academies.
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
        title="Academies"
        description="Opt in to teacher academies to use their published courses."
      />

      <Section title="Active subscriptions">
        {subscriptions === undefined ? (
          <p className="text-sm text-[var(--muted)]">Loading…</p>
        ) : subscriptions.length === 0 ? (
          <EmptyState>No subscriptions yet — browse academies below.</EmptyState>
        ) : (
          <ul className="space-y-2">
            {subscriptions.map(({ academy, subscription }) => (
              <li key={subscription._id} className="list-row">
                <div className="min-w-0">
                  <p className="font-medium text-[var(--foreground)]">
                    {academy.name}
                  </p>
                  {academy.description && (
                    <p className="text-sm text-[var(--muted)]">
                      {academy.description}
                    </p>
                  )}
                </div>
                <Button
                  variant="danger"
                  size="sm"
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
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Browse academies">
        {academies === undefined ? (
          <p className="text-sm text-[var(--muted)]">Loading…</p>
        ) : academies.length === 0 ? (
          <EmptyState>
            No academies published yet. Teachers create them from the academy
            dashboard.
          </EmptyState>
        ) : (
          <ul className="space-y-2">
            {academies.map((a) => (
              <li key={a._id} className="list-row">
                <div className="min-w-0">
                  <p className="font-medium text-[var(--foreground)]">{a.name}</p>
                  {a.description && (
                    <p className="text-sm text-[var(--muted)]">{a.description}</p>
                  )}
                </div>
                {subscribedIds.has(a._id) ? (
                  <Badge tone="success">Subscribed</Badge>
                ) : (
                  <Button
                    size="sm"
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
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Message tone="success">{message}</Message>
    </div>
  );
}
