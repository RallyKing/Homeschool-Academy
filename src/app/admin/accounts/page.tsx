"use client";

import { Suspense } from "react";
import { PageHeader } from "@/components/ui";
import { SchoolAccountsSettings } from "@/components/SchoolAccountsSettings";

function AdminAccountsInner() {
  return (
    <div className="page-stack">
      <PageHeader
        compact
        eyebrow="Admin"
        title="Accounts"
        description="Create schools with a main parent, then add parents, teachers, students, and contacts."
      />
      <SchoolAccountsSettings defaultTab="school" />
    </div>
  );
}

export default function AdminAccountsPage() {
  return (
    <Suspense fallback={<p className="text-sm text-[var(--muted)]">Loading…</p>}>
      <AdminAccountsInner />
    </Suspense>
  );
}
