"use client";

import { Suspense } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { PageHeader } from "@/components/ui";
import { SchoolAccountsSettings } from "@/components/SchoolAccountsSettings";
import { MergeDuplicatesPanel } from "@/components/MergeDuplicatesPanel";

function AdminAccountsInner() {
  const user = useQuery(api.users.current);
  return (
    <div className="page-stack">
      <PageHeader
        compact
        eyebrow="Admin"
        title="Accounts"
        description="Create schools with a main parent, then add parents, teachers, students, and contacts."
      />
      <SchoolAccountsSettings defaultTab="school" />
      {user?.role === "superAdmin" ? <MergeDuplicatesPanel /> : null}
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
