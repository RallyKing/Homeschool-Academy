"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import {
  Badge,
  EmptyState,
  Input,
  PageHeader,
  Section,
} from "@/components/ui";

function ContactsInner() {
  const user = useQuery(api.users.current);
  const family = useQuery(api.users.myFamily);
  const contacts = useQuery(
    api.contacts.list,
    family?._id ? { familyId: family._id } : {},
  );
  const [q, setQ] = useState("");

  if (user === undefined) {
    return <p className="text-sm text-[var(--muted)]">Loading…</p>;
  }
  if (!user) {
    return <p className="text-sm text-[var(--muted)]">Please sign in.</p>;
  }

  const filtered = (contacts ?? []).filter((c) => {
    if (!q.trim()) return true;
    const hay = `${c.displayName} ${c.emails.join(" ")} ${c.kind} ${c.roleLabel ?? ""}`.toLowerCase();
    return hay.includes(q.trim().toLowerCase());
  });

  return (
    <div className="page-stack">
      <PageHeader
        compact
        eyebrow="Directory"
        title="Contacts"
        description="Profiles for schools, parents, teachers, tutors, and students. Dashboards stay the work surface."
      />
      <Section
        title="People & schools"
        action={
          <Input
            placeholder="Search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        }
      >
        {contacts === undefined ? (
          <p className="text-sm text-[var(--muted)]">Loading…</p>
        ) : filtered.length === 0 ? (
          <EmptyState>No contacts match.</EmptyState>
        ) : (
          <ul className="space-y-1.5">
            {filtered.map((c) => (
              <li key={c._id}>
                <Link
                  href={`/contacts/${c._id}`}
                  className="list-row list-row-dense hover-lift"
                >
                  <div className="min-w-0">
                    <p className="font-medium">{c.displayName}</p>
                    <p className="text-xs text-[var(--muted)]">
                      {c.emails[0] ?? "No email"}
                      {c.phones[0] ? ` · ${c.phones[0]}` : ""}
                    </p>
                  </div>
                  <Badge tone="neutral">{c.kind}</Badge>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

export default function ContactsPage() {
  return (
    <Suspense fallback={<p className="text-sm text-[var(--muted)]">Loading…</p>}>
      <ContactsInner />
    </Suspense>
  );
}
