"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useQuery } from "convex/react";
import Link from "next/link";
import { api } from "../../convex/_generated/api";

const linksByRole: Record<string, Array<{ href: string; label: string }>> = {
  superAdmin: [
    { href: "/admin", label: "Admin" },
    { href: "/family/dashboard", label: "Family" },
    { href: "/academy/dashboard", label: "Academy" },
  ],
  parent: [
    { href: "/family/dashboard", label: "Family" },
  ],
  teacher: [
    { href: "/academy/dashboard", label: "Academy" },
  ],
  student: [
    { href: "/student/dashboard", label: "Student" },
  ],
};

export function Nav() {
  const user = useQuery(api.users.current);
  const { signOut } = useAuthActions();

  if (user === undefined) {
    return (
      <header className="border-b border-neutral-200 px-4 py-3">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <Link href="/" className="font-semibold text-neutral-900">
            Homeschool Academy
          </Link>
          <span className="text-sm text-neutral-500">Loading…</span>
        </div>
      </header>
    );
  }

  if (user === null) {
    return (
      <header className="border-b border-neutral-200 px-4 py-3">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <Link href="/" className="font-semibold text-neutral-900">
            Homeschool Academy
          </Link>
          <nav className="flex gap-3 text-sm">
            <Link href="/sign-in" className="text-neutral-700 hover:underline">
              Sign in
            </Link>
            <Link href="/sign-up" className="text-neutral-700 hover:underline">
              Sign up
            </Link>
          </nav>
        </div>
      </header>
    );
  }

  const role = user.role ?? "parent";
  const links = linksByRole[role] ?? linksByRole.parent;

  return (
    <header className="border-b border-neutral-200 px-4 py-3">
      <div className="mx-auto flex max-w-4xl items-center justify-between gap-4">
        <Link href="/" className="font-semibold text-neutral-900">
          Homeschool Academy
        </Link>
        <nav className="flex flex-wrap items-center gap-3 text-sm">
          {links?.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-neutral-700 hover:underline"
            >
              {link.label}
            </Link>
          ))}
          <span className="text-neutral-400">|</span>
          <span className="text-neutral-500">{user.email ?? user.name}</span>
          <button
            type="button"
            onClick={() => void signOut()}
            className="text-neutral-700 hover:underline"
          >
            Sign out
          </button>
        </nav>
      </div>
    </header>
  );
}
