"use client";

import { Suspense } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useQuery } from "convex/react";
import Link from "next/link";
import { api } from "../../convex/_generated/api";
import { useViewAsStudentId } from "@/hooks/useViewAsStudentId";
import { withViewAs } from "@/lib/viewAs";
import { Container } from "@/components/ui";
import { cn } from "@/lib/cn";

const sharedLinks = [
  { href: "/updates", label: "Updates" },
  { href: "/help", label: "Help" },
];

const linksByRole: Record<string, Array<{ href: string; label: string }>> = {
  superAdmin: [
    { href: "/admin", label: "Admin" },
    { href: "/admin/product-updates", label: "Manage updates" },
    { href: "/admin/knowledge-base", label: "Manage KB" },
    { href: "/family/dashboard", label: "Family" },
    { href: "/family/planner", label: "Planner" },
    { href: "/family/ledger", label: "Ledger" },
    { href: "/academy/dashboard", label: "Academy" },
    { href: "/family/ai", label: "AI" },
    ...sharedLinks,
  ],
  parent: [
    { href: "/family/dashboard", label: "Family" },
    { href: "/family/courses", label: "Courses" },
    { href: "/family/planner", label: "Planner" },
    { href: "/family/ledger", label: "Ledger" },
    { href: "/family/academies", label: "Academies" },
    { href: "/family/progress", label: "Progress" },
    { href: "/family/ai", label: "AI" },
    ...sharedLinks,
  ],
  teacher: [
    { href: "/academy/dashboard", label: "Academy" },
    ...sharedLinks,
  ],
  student: [
    { href: "/student/dashboard", label: "Today" },
    ...sharedLinks,
  ],
};

const viewAsLinks = [
  { href: "/student/dashboard", label: "Today" },
  { href: "/family/dashboard", label: "Exit to family" },
];

function NavShell({ children }: { children: React.ReactNode }) {
  return (
    <header className="glass-nav sticky top-0 z-40">
      <Container size="wide" className="flex items-center justify-between gap-4 py-3.5">
        {children}
      </Container>
    </header>
  );
}

function BrandLink() {
  return (
    <Link
      href="/"
      className="font-display text-[15px] font-semibold tracking-tight text-[var(--foreground)] transition-opacity hover:opacity-70"
    >
      Homeschool Academy
    </Link>
  );
}

function NavLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "rounded-[var(--radius-sm)] px-2.5 py-1.5 text-sm font-medium text-[var(--muted)]",
        "transition-colors duration-200 hover:bg-[var(--accent-soft)] hover:text-[var(--accent)]",
      )}
    >
      {children}
    </Link>
  );
}

function NavInner() {
  const user = useQuery(api.users.current);
  const { signOut } = useAuthActions();
  const viewAsStudentId = useViewAsStudentId();
  const viewAs = useQuery(
    api.students.getViewAsContext,
    viewAsStudentId ? { studentId: viewAsStudentId } : "skip",
  );

  if (user === undefined) {
    return (
      <NavShell>
        <BrandLink />
        <span className="text-sm text-[var(--muted-fg)]">Loading…</span>
      </NavShell>
    );
  }

  if (user === null) {
    return (
      <NavShell>
        <BrandLink />
        <nav className="flex items-center gap-1">
          <NavLink href="/sign-in">Sign in</NavLink>
          <Link
            href="/sign-up"
            className="ml-1 rounded-[var(--radius-md)] bg-[var(--accent)] px-3.5 py-2 text-sm font-medium text-white shadow-sm transition-all duration-200 hover:bg-[var(--accent-hover)] active:scale-[0.98]"
          >
            Sign up
          </Link>
        </nav>
      </NavShell>
    );
  }

  const role = user.role ?? "parent";
  const impersonating = Boolean(viewAs?.viewingAs && viewAsStudentId);
  const links = impersonating
    ? viewAsLinks
    : (linksByRole[role] ?? linksByRole.parent);

  return (
    <NavShell>
      <BrandLink />
      <nav className="flex max-w-[70%] flex-wrap items-center justify-end gap-0.5">
        {links?.map((link) => (
          <NavLink
            key={link.href}
            href={
              impersonating && link.href.startsWith("/student")
                ? withViewAs(link.href, viewAsStudentId)
                : link.href
            }
          >
            {link.label}
          </NavLink>
        ))}
        <span className="mx-1 hidden h-4 w-px bg-[var(--border-strong)] sm:inline-block" />
        <span className="hidden max-w-[10rem] truncate px-2 text-xs text-[var(--muted-fg)] sm:inline">
          {user.email ?? user.name}
        </span>
        <button
          type="button"
          onClick={() => void signOut()}
          className="rounded-[var(--radius-sm)] px-2.5 py-1.5 text-sm font-medium text-[var(--muted)] transition-colors duration-200 hover:bg-[var(--danger-soft)] hover:text-[var(--danger)]"
        >
          Sign out
        </button>
      </nav>
    </NavShell>
  );
}

export function Nav() {
  return (
    <Suspense
      fallback={
        <NavShell>
          <span className="font-display text-[15px] font-semibold tracking-tight">
            Homeschool Academy
          </span>
          <span className="text-sm text-[var(--muted-fg)]">Loading…</span>
        </NavShell>
      }
    >
      <NavInner />
    </Suspense>
  );
}
