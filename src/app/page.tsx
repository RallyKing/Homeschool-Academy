"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { RoleRedirect } from "@/components/RoleRedirect";
import { api } from "../../convex/_generated/api";
import { Button } from "@/components/ui";

export default function HomePage() {
  const user = useQuery(api.users.current);

  if (user === undefined) {
    return <p className="text-sm text-[var(--muted)]">Loading…</p>;
  }

  if (user) {
    return <RoleRedirect />;
  }

  return (
    <div className="relative -mx-4 -mt-8 min-h-[calc(100vh-4rem)] overflow-hidden px-4 sm:-mx-6 sm:px-6">
      {/* Full-bleed soft atmosphere */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(ellipse 90% 70% at 50% -10%, rgba(14,116,144,0.14), transparent 55%), radial-gradient(ellipse 60% 50% at 90% 80%, rgba(14,116,144,0.06), transparent 50%)",
        }}
      />

      <section className="mx-auto flex max-w-3xl flex-col items-start justify-center py-16 sm:min-h-[70vh] sm:py-24 animate-fade-up">
        <p className="mb-4 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--accent)]">
          Companion &amp; Tracker
        </p>
        <h1 className="font-display text-5xl font-semibold tracking-tight text-[var(--foreground)] sm:text-6xl md:text-7xl">
          Homeschool Academy
        </h1>
        <p className="mt-5 max-w-xl text-lg leading-relaxed text-[var(--muted)]">
          Log learning time, plan weeks, and connect families with academy
          courses — calm tools for intentional home education.
        </p>
        <div className="mt-10 flex flex-wrap gap-3">
          <Link href="/sign-up">
            <Button size="lg">Get started</Button>
          </Link>
          <Link href="/sign-in">
            <Button size="lg" variant="secondary">
              Sign in
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
