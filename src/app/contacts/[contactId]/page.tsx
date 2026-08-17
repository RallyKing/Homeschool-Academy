"use client";

import { Suspense, use } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Badge, Button, EmptyState, PageHeader, Section } from "@/components/ui";

function ContactDetailInner({ contactId }: { contactId: Id<"contacts"> }) {
  const detail = useQuery(api.contacts.get, { contactId });

  if (detail === undefined) {
    return <p className="text-sm text-[var(--muted)]">Loading…</p>;
  }
  if (detail === null) {
    return (
      <div className="page-stack">
        <PageHeader compact title="Contact" description="Not found or no access." />
        <Link href="/contacts">
          <Button variant="secondary" size="sm">
            Back to directory
          </Button>
        </Link>
      </div>
    );
  }

  const { contact, students, courses, schoolName } = detail;

  return (
    <div className="page-stack">
      <PageHeader
        compact
        eyebrow="Directory"
        title={contact.displayName}
        description={contact.roleLabel ?? contact.kind}
        actions={
          <Link href="/contacts">
            <Button variant="ghost" size="sm">
              Directory
            </Button>
          </Link>
        }
      />

      <Section title="Profile">
        <ul className="space-y-1.5">
          <li className="list-row list-row-dense">
            <span className="text-sm text-[var(--muted)]">Kind</span>
            <Badge tone="neutral">{contact.kind}</Badge>
          </li>
          {schoolName ? (
            <li className="list-row list-row-dense">
              <span className="text-sm text-[var(--muted)]">School</span>
              <span className="text-sm font-medium">{schoolName}</span>
            </li>
          ) : null}
          <li className="list-row list-row-dense">
            <span className="text-sm text-[var(--muted)]">Emails</span>
            <span className="text-sm font-medium">
              {contact.emails.join(", ") || "—"}
            </span>
          </li>
          <li className="list-row list-row-dense">
            <span className="text-sm text-[var(--muted)]">Phones</span>
            <span className="text-sm font-medium">
              {contact.phones.join(", ") || "—"}
            </span>
          </li>
          {contact.notes ? (
            <li className="list-row list-row-dense">
              <span className="text-sm text-[var(--muted)]">Notes</span>
              <span className="text-sm">{contact.notes}</span>
            </li>
          ) : null}
        </ul>
      </Section>

      <Section title="Students">
        {students.length === 0 ? (
          <EmptyState>No linked students.</EmptyState>
        ) : (
          <ul className="space-y-1.5">
            {students.map((s) => (
              <li key={s._id} className="list-row list-row-dense">
                <span className="font-medium">{s.displayName}</span>
                <Link href={`/family/students/${s._id}`}>
                  <Button variant="ghost" size="sm">
                    Dashboard
                  </Button>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Classes / courses">
        {courses.length === 0 ? (
          <EmptyState>No linked courses.</EmptyState>
        ) : (
          <ul className="space-y-1.5">
            {courses.map((c) => (
              <li key={c._id} className="list-row list-row-dense">
                <span className="font-medium">{c.title}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

export default function ContactDetailPage({
  params,
}: {
  params: Promise<{ contactId: string }>;
}) {
  const { contactId } = use(params);
  return (
    <Suspense fallback={<p className="text-sm text-[var(--muted)]">Loading…</p>}>
      <ContactDetailInner contactId={contactId as Id<"contacts">} />
    </Suspense>
  );
}
