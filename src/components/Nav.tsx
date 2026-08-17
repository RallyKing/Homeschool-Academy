"use client";

import { Suspense, useEffect, useId, useRef, useState } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useQuery } from "convex/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { api } from "../../convex/_generated/api";
import { HardRefreshButton } from "@/components/HardRefreshButton";
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
    { href: "/updates", label: "What's new" },
    { href: "/help", label: "Help / Knowledge base" },
  ],
};

function accountGroupFor(role: "parent" | "student" | "shared" | "admin"): NavGroup {
  if (role === "parent") {
    return {
      ...accountGroup,
      items: [
        { href: "/family/settings", label: "Settings" },
        { href: "/contacts", label: "Contacts" },
        ...accountGroup.items,
      ],
    };
  }
  if (role === "admin") {
    return {
      ...accountGroup,
      items: [
        { href: "/family/settings", label: "Settings" },
        { href: "/admin/accounts", label: "Accounts" },
        { href: "/contacts", label: "Contacts" },
        ...accountGroup.items,
      ],
    };
  }
  if (role === "student") {
    return {
      ...accountGroup,
      items: [
        { href: "/student/settings", label: "Settings" },
        ...accountGroup.items,
      ],
    };
  }
  return accountGroup;
}

const navByRole: Record<string, NavEntry[]> = {
  superAdmin: [
    {
      kind: "group",
      group: {
        id: "admin",
        label: "Admin",
        items: [
          { href: "/admin", label: "Overview" },
          { href: "/admin/accounts", label: "Accounts" },
          { href: "/admin/product-updates", label: "Manage updates" },
          { href: "/admin/knowledge-base", label: "Manage KB" },
          { href: "/admin/speech-reports", label: "Speech reports" },
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
          { href: "/family/cheers", label: "Family wall" },
          { href: "/alerts", label: "Alerts" },
        ],
      },
    },
    { kind: "group", group: accountGroupFor("admin") },
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
          { href: "/family/read-along", label: "Read-along" },
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
          { href: "/family/cheers", label: "Family wall" },
          { href: "/alerts", label: "Alerts" },
          { href: "/family/academies", label: "Academies" },
          { href: "/family/settings", label: "Settings" },
        ],
      },
    },
    { kind: "group", group: accountGroupFor("parent") },
  ],
  teacher: [
    { kind: "link", link: { href: "/academy/dashboard", label: "Academy" } },
    { kind: "link", link: { href: "/academy/cheers", label: "Student cheers" } },
    { kind: "link", link: { href: "/contacts", label: "Contacts" } },
    { kind: "link", link: { href: "/alerts", label: "Alerts" } },
    { kind: "group", group: accountGroupFor("shared") },
  ],
  student: [
    { kind: "link", link: { href: "/student/dashboard", label: "Today" } },
    { kind: "link", link: { href: "/student/read-along", label: "Read" } },
    { kind: "link", link: { href: "/student/chores", label: "Chores" } },
    {
      kind: "group",
      group: {
        id: "life",
        label: "Life",
        items: [
          { href: "/student/social", label: "Cheer" },
          { href: "/alerts", label: "Alerts" },
          { href: "/student/settings", label: "Settings" },
        ],
      },
    },
    { kind: "group", group: accountGroupFor("student") },
  ],
};

const viewAsEntries: NavEntry[] = [
  { kind: "link", link: { href: "/student/dashboard", label: "Today" } },
  { kind: "link", link: { href: "/student/read-along", label: "Read" } },
  { kind: "link", link: { href: "/student/chores", label: "Chores" } },
  { kind: "link", link: { href: "/student/social", label: "Cheer" } },
  { kind: "link", link: { href: "/family/dashboard", label: "Exit preview" } },
];

function NavShell({ children }: { children: React.ReactNode }) {
  return (
    <header className="glass-nav sticky top-0 z-40">
      <Container size="wide" className="flex items-center justify-between gap-3 py-3">
        <div className="flex min-w-0 items-center gap-0.5">
          <BrandLink />
          <HardRefreshButton />
        </div>
        {children}
      </Container>
    </header>
  );
}

function BrandLink() {
  return (
    <Link
      href="/"
      className="hover-fade shrink-0 font-display text-[15px] font-semibold tracking-tight text-[var(--foreground)] hover:opacity-70"
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
        "hover-fade rounded-[var(--radius-sm)] px-2.5 py-1.5 text-sm font-medium",
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
  wallUnread,
}: {
  group: NavGroup;
  pathname: string;
  resolveHref: (href: string) => string;
  wallUnread?: number | null;
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
          "hover-fade inline-flex items-center gap-1 rounded-[var(--radius-sm)] px-2.5 py-1.5 text-sm font-medium",
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
          className="absolute right-0 z-50 mt-1.5 min-w-[14rem] overflow-hidden rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] py-1 shadow-[var(--shadow-md)] animate-fade-up"
        >
          {group.items.map((item) => {
            const href = resolveHref(item.href);
            const itemActive =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            const showWallBadge =
              wallUnread != null &&
              wallUnread > 0 &&
              (item.href === "/family/cheers" || item.href === "/student/social");
            return (
              <Link
                key={item.href}
                role="menuitem"
                href={href}
                onClick={() => setOpen(false)}
                className={cn(
                  "hover-fade flex items-center justify-between gap-2 px-3.5 py-2.5 text-sm",
                  itemActive
                    ? "bg-[var(--accent-soft)] font-medium text-[var(--accent)]"
                    : "text-[var(--foreground)] hover:bg-[var(--surface-2)]",
                )}
              >
                <span>{item.label}</span>
                {showWallBadge ? (
                  <span className="rounded-full bg-[var(--accent)] px-1.5 py-0.5 text-[10px] font-semibold text-white">
                    {wallUnread > 9 ? "9+" : wallUnread}
                  </span>
                ) : null}
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
  const family = useQuery(api.users.myFamily, user ? {} : "skip");
  const [wallNow] = useState(() => Date.now());
  const wallUnread = useQuery(
    api.feed.unreadCount,
    family?._id ? { familyId: family._id, now: wallNow } : "skip",
  );
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
        <span className="text-sm text-[var(--muted-fg)]">Loading…</span>
      </NavShell>
    );
  }

  if (user === null) {
    return (
      <NavShell>
        <nav className="flex items-center gap-1">
          <InstallAppButton />
          <NavLink href="/sign-in">Sign in</NavLink>
          <Link
            href="/sign-up"
            className="hover-lift ml-1 rounded-[var(--radius-md)] bg-[var(--accent)] px-3.5 py-2 text-sm font-medium text-white shadow-sm hover:bg-[var(--accent-hover)] hover:brightness-[1.03]"
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
              wallUnread={wallUnread}
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
          className="hover-fade rounded-[var(--radius-sm)] px-2.5 py-1.5 text-sm font-medium text-[var(--muted)] hover:bg-[var(--danger-soft)] hover:text-[var(--danger)]"
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
          <span className="text-sm text-[var(--muted-fg)]">Loading…</span>
        </NavShell>
      }
    >
      <NavInner />
    </Suspense>
  );
}
