"use client";

import { Suspense, useEffect, useId, useRef, useState } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useQuery } from "convex/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { api } from "../../convex/_generated/api";
import { InstallAppButton } from "@/components/InstallAppButton";
import { useViewAsStudentId } from "@/hooks/useViewAsStudentId";
import { withViewAs } from "@/lib/viewAs";
import { Container } from "@/components/ui";
import { cn } from "@/lib/cn";

type NavLinkItem = { href: string; label: string };
type NavGroup = { id: string; label: string; items: NavLinkItem[] };
type NavEntry = { kind: "link"; link: NavLinkItem } | { kind: "group"; group: NavGroup };

const accountGroup: NavGroup = {
  id: "account",
  label: "Account",
  items: [
    { href: "/updates", label: "Updates" },
    { href: "/help", label: "Help" },
  ],
};

const navByRole: Record<string, NavEntry[]> = {
  superAdmin: [
    {
      kind: "group",
      group: {
        id: "admin",
        label: "Admin",
        items: [
          { href: "/admin", label: "Overview" },
          { href: "/admin/product-updates", label: "Manage updates" },
          { href: "/admin/knowledge-base", label: "Manage KB" },
        ],
      },
    },
    { kind: "link", link: { href: "/family/dashboard", label: "Family" } },
    { kind: "link", link: { href: "/academy/dashboard", label: "Academy" } },
    {
      kind: "group",
      group: {
        id: "life",
        label: "Life",
        items: [
          { href: "/family/chores", label: "Chores" },
          { href: "/alerts", label: "Alerts" },
        ],
      },
    },
    { kind: "group", group: accountGroup },
  ],
  parent: [
    { kind: "link", link: { href: "/family/dashboard", label: "Home" } },
    {
      kind: "group",
      group: {
        id: "learn",
        label: "Learn",
        items: [
          { href: "/family/courses", label: "Courses" },
          { href: "/family/planner", label: "Planner" },
          { href: "/family/ledger", label: "Ledger" },
          { href: "/family/progress", label: "Progress" },
          { href: "/family/ai", label: "AI" },
        ],
      },
    },
    {
      kind: "group",
      group: {
        id: "life",
        label: "Life",
        items: [
          { href: "/family/chores", label: "Chores & rewards" },
          { href: "/alerts", label: "Alerts" },
          { href: "/family/academies", label: "Academies" },
        ],
      },
    },
    { kind: "group", group: accountGroup },
  ],
  teacher: [
    { kind: "link", link: { href: "/academy/dashboard", label: "Academy" } },
    { kind: "link", link: { href: "/alerts", label: "Alerts" } },
    { kind: "group", group: accountGroup },
  ],
  student: [
    { kind: "link", link: { href: "/student/dashboard", label: "Today" } },
    { kind: "link", link: { href: "/student/chores", label: "Chores" } },
    { kind: "link", link: { href: "/alerts", label: "Alerts" } },
    { kind: "group", group: accountGroup },
  ],
};

const viewAsEntries: NavEntry[] = [
  { kind: "link", link: { href: "/student/dashboard", label: "Today" } },
  { kind: "link", link: { href: "/student/chores", label: "Chores" } },
  { kind: "link", link: { href: "/family/dashboard", label: "Exit preview" } },
];

function NavShell({ children }: { children: React.ReactNode }) {
  return (
    <header className="glass-nav sticky top-0 z-40">
      <Container size="wide" className="flex items-center justify-between gap-3 py-3">
        {children}
      </Container>
    </header>
  );
}

function BrandLink() {
  return (
    <Link
      href="/"
      className="shrink-0 font-display text-[15px] font-semibold tracking-tight text-[var(--foreground)] transition-opacity hover:opacity-70"
    >
      Homeschool Academy
    </Link>
  );
}

function NavLink({
  href,
  children,
  active,
}: {
  href: string;
  children: React.ReactNode;
  active?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "rounded-[var(--radius-sm)] px-2.5 py-1.5 text-sm font-medium",
        "transition-colors duration-200",
        active
          ? "bg-[var(--accent-soft)] text-[var(--accent)]"
          : "text-[var(--muted)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent)]",
      )}
    >
      {children}
    </Link>
  );
}

function NavDropdown({
  group,
  pathname,
  resolveHref,
}: {
  group: NavGroup;
  pathname: string;
  resolveHref: (href: string) => string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const active = group.items.some(
    (item) =>
      pathname === item.href || pathname.startsWith(`${item.href}/`),
  );

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={menuId}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "inline-flex items-center gap-1 rounded-[var(--radius-sm)] px-2.5 py-1.5 text-sm font-medium",
          "transition-colors duration-200",
          active || open
            ? "bg-[var(--accent-soft)] text-[var(--accent)]"
            : "text-[var(--muted)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent)]",
        )}
      >
        {group.label}
        <span className="text-[10px] opacity-70" aria-hidden>
          ▾
        </span>
      </button>
      {open ? (
        <div
          id={menuId}
          role="menu"
          className="absolute right-0 z-50 mt-1.5 min-w-[11rem] overflow-hidden rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] py-1 shadow-[var(--shadow-md)] animate-fade-up"
        >
          {group.items.map((item) => {
            const href = resolveHref(item.href);
            const itemActive =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                role="menuitem"
                href={href}
                onClick={() => setOpen(false)}
                className={cn(
                  "block px-3.5 py-2.5 text-sm transition-colors",
                  itemActive
                    ? "bg-[var(--accent-soft)] font-medium text-[var(--accent)]"
                    : "text-[var(--foreground)] hover:bg-[var(--surface-2)]",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function NavInner() {
  const user = useQuery(api.users.current);
  const { signOut } = useAuthActions();
  const pathname = usePathname();
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
          <InstallAppButton />
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
  const entries = impersonating
    ? viewAsEntries
    : (navByRole[role] ?? navByRole.parent);

  function resolveHref(href: string) {
    if (impersonating && href.startsWith("/student")) {
      return withViewAs(href, viewAsStudentId);
    }
    return href;
  }

  return (
    <NavShell>
      <BrandLink />
      <nav className="flex max-w-[78%] flex-wrap items-center justify-end gap-0.5">
        {entries.map((entry) =>
          entry.kind === "link" ? (
            <NavLink
              key={entry.link.href}
              href={resolveHref(entry.link.href)}
              active={
                pathname === entry.link.href ||
                pathname.startsWith(`${entry.link.href}/`)
              }
            >
              {entry.link.label}
            </NavLink>
          ) : (
            <NavDropdown
              key={entry.group.id}
              group={entry.group}
              pathname={pathname}
              resolveHref={resolveHref}
            />
          ),
        )}
        <span className="mx-1 hidden h-4 w-px bg-[var(--border-strong)] sm:inline-block" />
        <InstallAppButton />
        <span className="hidden max-w-[9rem] truncate px-2 text-xs text-[var(--muted-fg)] lg:inline">
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
