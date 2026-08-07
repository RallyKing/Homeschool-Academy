"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { RoleRedirect } from "@/components/RoleRedirect";
import { api } from "../../convex/_generated/api";

export default function HomePage() {
  const user = useQuery(api.users.current);

  if (user === undefined) {
    return <p className="text-sm text-neutral-500">Loading…</p>;
  }

  if (user) {
    return <RoleRedirect />;
  }

  return (
    <div className="space-y-4 py-10">
      <h1 className="text-3xl font-semibold tracking-tight">
        Homeschool Academy
      </h1>
      <p className="max-w-xl text-neutral-600">
        Companion &amp; Tracker — log learning time, plan weeks, and connect
        families with academy courses.
      </p>
      <div className="flex gap-3">
        <Link
          href="/sign-up"
          className="border border-neutral-900 bg-neutral-900 px-4 py-2 text-sm text-white"
        >
          Get started
        </Link>
        <Link
          href="/sign-in"
          className="border border-neutral-400 px-4 py-2 text-sm"
        >
          Sign in
        </Link>
      </div>
    </div>
  );
}
