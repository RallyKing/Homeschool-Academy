/**
 * Central breadcrumb config: pathname (+ optional tab) → crumb trail.
 * Dynamic labels (student name, article title) are filled in by BreadcrumbBar.
 */

export type BreadcrumbItem = {
  label: string;
  /** Omit href (or leave undefined) for the current page. */
  href?: string;
};

export type BreadcrumbRole =
  | "parent"
  | "student"
  | "teacher"
  | "superAdmin"
  | string
  | undefined;

export type BreadcrumbBuildContext = {
  pathname: string;
  tab: string | null;
  role: BreadcrumbRole;
  labels: {
    studentName?: string;
    articleTitle?: string;
  };
};

type CrumbBuilder = (ctx: BreadcrumbBuildContext) => BreadcrumbItem[];

function homeHref(role: BreadcrumbRole): string {
  switch (role) {
    case "student":
      return "/student/dashboard";
    case "teacher":
      return "/academy/dashboard";
    case "superAdmin":
      return "/admin";
    default:
      return "/family/dashboard";
  }
}

function homeCrumb(role: BreadcrumbRole, current = false): BreadcrumbItem {
  return current
    ? { label: "Home" }
    : { label: "Home", href: homeHref(role) };
}

const STUDENT_TAB_LABELS: Record<string, string> = {
  profile: "Profile",
  logs: "Logs",
  chores: "Chores",
  plan: "Plan",
  social: "Social",
  rewards: "Rewards",
};

const CHORES_TAB_LABELS: Record<string, string> = {
  chores: "Chores",
  rewards: "Rewards",
};

const FAMILY_DASH_TAB_LABELS: Record<string, string> = {
  overview: "Overview",
  students: "Students",
  household: "Household",
};

const FAMILY_SETTINGS_TAB_LABELS: Record<string, string> = {
  household: "Household",
  students: "Students",
  subjects: "Subjects",
  academies: "Academies",
  rewards: "Rewards & shop",
  notifications: "Notifications",
  privacy: "Privacy & social",
  ai: "AI & guardrails",
  account: "Account",
};

const STUDENT_SETTINGS_TAB_LABELS: Record<string, string> = {
  profile: "Profile",
  customization: "Customization",
  notifications: "Notifications",
  privacy: "Privacy",
  account: "Account",
};

const STUDENT_DASH_TAB_LABELS: Record<string, string> = {
  home: "Today",
  quests: "Quests",
  plan: "Plan",
  log: "Log",
  chores: "Chores",
  cheer: "Cheer",
  profile: "Profile",
};

const ADMIN_TAB_LABELS: Record<string, string> = {
  overview: "Overview",
  subjects: "Subjects",
  orgs: "Orgs",
  users: "Users",
};

/** Paths where breadcrumbs should not render. */
export const BREADCRUMB_HIDDEN_PATHS = new Set([
  "/",
  "/sign-in",
  "/sign-up",
  "/reset-password",
  "/~offline",
]);

type RouteRule = {
  /** Exact pathname or prefix pattern ending with `/*` */
  test: (pathname: string) => boolean;
  build: CrumbBuilder;
};

function exact(path: string): (pathname: string) => boolean {
  return (pathname) => pathname === path;
}

function matchStudentId(
  pathname: string,
  prefix: string,
): string | null {
  if (!pathname.startsWith(`${prefix}/`)) return null;
  const rest = pathname.slice(prefix.length + 1);
  const id = rest.split("/")[0];
  return id || null;
}

const ROUTES: RouteRule[] = [
  // ── Family ──────────────────────────────────────────────
  {
    test: exact("/family/dashboard"),
    build: (ctx) => {
      const crumbs: BreadcrumbItem[] = [homeCrumb(ctx.role, !ctx.tab || ctx.tab === "overview")];
      if (ctx.tab && ctx.tab !== "overview") {
        const label = FAMILY_DASH_TAB_LABELS[ctx.tab] ?? titleCase(ctx.tab);
        crumbs[0] = homeCrumb(ctx.role);
        crumbs.push({ label });
      }
      return crumbs;
    },
  },
  {
    test: exact("/family/courses"),
    build: (ctx) => [
      homeCrumb(ctx.role),
      { label: "Learn", href: "/family/courses" },
      { label: "Courses" },
    ],
  },
  {
    test: exact("/family/planner"),
    build: (ctx) => [
      homeCrumb(ctx.role),
      { label: "Learn", href: "/family/courses" },
      { label: "Planner" },
    ],
  },
  {
    test: exact("/family/ledger"),
    build: (ctx) => [
      homeCrumb(ctx.role),
      { label: "Learn", href: "/family/courses" },
      { label: "Ledger" },
    ],
  },
  {
    test: exact("/family/progress"),
    build: (ctx) => [
      homeCrumb(ctx.role),
      { label: "Learn", href: "/family/courses" },
      { label: "Progress" },
    ],
  },
  {
    test: (p) => Boolean(matchStudentId(p, "/family/progress")),
    build: (ctx) => {
      const name = ctx.labels.studentName ?? "Student";
      return [
        homeCrumb(ctx.role),
        { label: "Learn", href: "/family/courses" },
        { label: "Progress", href: "/family/progress" },
        { label: name },
      ];
    },
  },
  {
    test: (p) => Boolean(matchStudentId(p, "/family/students")),
    build: (ctx) => {
      const id = matchStudentId(ctx.pathname, "/family/students")!;
      const name = ctx.labels.studentName ?? "Student";
      const crumbs: BreadcrumbItem[] = [
        homeCrumb(ctx.role),
        { label: "Students", href: "/family/dashboard?tab=students" },
        {
          label: name,
          href:
            ctx.tab && ctx.tab !== "profile"
              ? `/family/students/${id}`
              : undefined,
        },
      ];
      if (ctx.tab && ctx.tab !== "profile") {
        crumbs.push({
          label: STUDENT_TAB_LABELS[ctx.tab] ?? titleCase(ctx.tab),
        });
      }
      // Current page: drop href on last crumb
      const last = crumbs[crumbs.length - 1]!;
      delete last.href;
      return crumbs;
    },
  },
  {
    test: exact("/family/ai"),
    build: (ctx) => [
      homeCrumb(ctx.role),
      { label: "Learn", href: "/family/courses" },
      { label: "AI" },
    ],
  },
  {
    test: exact("/family/chores"),
    build: (ctx) => {
      const crumbs: BreadcrumbItem[] = [
        homeCrumb(ctx.role),
        { label: "Life", href: "/family/chores" },
      ];
      if (ctx.tab && ctx.tab !== "chores" && CHORES_TAB_LABELS[ctx.tab]) {
        crumbs.push({ label: "Chores", href: "/family/chores" });
        crumbs.push({ label: CHORES_TAB_LABELS[ctx.tab]! });
      } else {
        crumbs.push({ label: "Chores & rewards" });
      }
      return crumbs;
    },
  },
  {
    test: exact("/family/cheers"),
    build: (ctx) => [
      homeCrumb(ctx.role),
      { label: "Life", href: "/family/chores" },
      { label: "Family wall" },
    ],
  },
  {
    test: exact("/family/feed"),
    build: (ctx) => [
      homeCrumb(ctx.role),
      { label: "Life", href: "/family/chores" },
      { label: "Family wall", href: "/family/cheers?tab=wall" },
    ],
  },
  {
    test: exact("/family/academies"),
    build: (ctx) => [
      homeCrumb(ctx.role),
      { label: "Life", href: "/family/chores" },
      { label: "Academies" },
    ],
  },
  {
    test: exact("/family/settings"),
    build: (ctx) => {
      const crumbs: BreadcrumbItem[] = [
        homeCrumb(ctx.role),
        { label: "Settings", href: "/family/settings" },
      ];
      if (ctx.tab && ctx.tab !== "household") {
        crumbs.push({
          label: FAMILY_SETTINGS_TAB_LABELS[ctx.tab] ?? titleCase(ctx.tab),
        });
      } else {
        crumbs[crumbs.length - 1] = { label: "Settings" };
      }
      return crumbs;
    },
  },

  // ── Student ─────────────────────────────────────────────
  {
    test: exact("/student/dashboard"),
    build: (ctx) => {
      const crumbs: BreadcrumbItem[] = [
        homeCrumb(ctx.role, !ctx.tab || ctx.tab === "home"),
      ];
      if (ctx.tab && ctx.tab !== "home" && STUDENT_DASH_TAB_LABELS[ctx.tab]) {
        crumbs[0] = homeCrumb(ctx.role);
        crumbs.push({ label: STUDENT_DASH_TAB_LABELS[ctx.tab]! });
      }
      return crumbs;
    },
  },
  {
    test: exact("/student/chores"),
    build: (ctx) => [homeCrumb(ctx.role), { label: "Chores" }],
  },
  {
    test: exact("/student/social"),
    build: (ctx) => [
      homeCrumb(ctx.role),
      { label: "Life", href: "/student/social" },
      { label: "Cheer" },
    ],
  },
  {
    test: exact("/student/settings"),
    build: (ctx) => {
      const crumbs: BreadcrumbItem[] = [
        homeCrumb(ctx.role),
        { label: "Settings", href: "/student/settings" },
      ];
      if (ctx.tab && ctx.tab !== "profile") {
        crumbs.push({
          label: STUDENT_SETTINGS_TAB_LABELS[ctx.tab] ?? titleCase(ctx.tab),
        });
      } else {
        crumbs[crumbs.length - 1] = { label: "Settings" };
      }
      return crumbs;
    },
  },

  // ── Academy ─────────────────────────────────────────────
  {
    test: exact("/academy/dashboard"),
    build: () => [{ label: "Academy" }],
  },

  // ── Admin ───────────────────────────────────────────────
  {
    test: exact("/admin"),
    build: (ctx) => {
      const crumbs: BreadcrumbItem[] = [
        { label: "Admin", href: "/admin" },
      ];
      const tab = ctx.tab && ADMIN_TAB_LABELS[ctx.tab] ? ctx.tab : "overview";
      if (tab === "overview") {
        crumbs[0] = { label: "Admin" };
        crumbs.push({ label: "Overview" });
      } else {
        crumbs.push({ label: ADMIN_TAB_LABELS[tab]! });
      }
      return crumbs;
    },
  },
  {
    test: exact("/admin/product-updates"),
    build: () => [
      { label: "Admin", href: "/admin" },
      { label: "Manage updates" },
    ],
  },
  {
    test: exact("/admin/knowledge-base"),
    build: () => [
      { label: "Admin", href: "/admin" },
      { label: "Manage KB" },
    ],
  },

  // ── Shared account / alerts ─────────────────────────────
  {
    test: exact("/alerts"),
    build: (ctx) => [homeCrumb(ctx.role), { label: "Alerts" }],
  },
  {
    test: exact("/updates"),
    build: () => [{ label: "Account" }, { label: "What's new" }],
  },
  {
    test: exact("/help"),
    build: () => [
      { label: "Account" },
      { label: "Knowledge base" },
    ],
  },
  {
    test: (p) => p.startsWith("/help/") && p !== "/help/",
    build: (ctx) => [
      { label: "Account" },
      { label: "Knowledge base", href: "/help" },
      { label: ctx.labels.articleTitle ?? "Article" },
    ],
  },
  {
    test: exact("/onboarding"),
    build: () => [{ label: "Account" }, { label: "Get started" }],
  },
];

function titleCase(value: string): string {
  return value
    .split(/[-_]/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/**
 * Build breadcrumb items for a pathname. Returns null when crumbs should hide.
 */
export function buildBreadcrumbs(
  ctx: BreadcrumbBuildContext,
): BreadcrumbItem[] | null {
  const path = ctx.pathname.replace(/\/$/, "") || "/";
  if (BREADCRUMB_HIDDEN_PATHS.has(path)) {
    return null;
  }

  for (const rule of ROUTES) {
    if (rule.test(path)) {
      return rule.build({ ...ctx, pathname: path });
    }
  }

  // Fallback: Home > Segment labels from path
  const segments = path.split("/").filter(Boolean);
  if (segments.length === 0) return null;

  const crumbs: BreadcrumbItem[] = [homeCrumb(ctx.role)];
  let acc = "";
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]!;
    acc += `/${seg}`;
    const isLast = i === segments.length - 1;
    crumbs.push({
      label: titleCase(seg),
      href: isLast ? undefined : acc,
    });
  }
  return crumbs;
}

/** Extract dynamic route params used for label resolution. */
export function breadcrumbParams(pathname: string): {
  studentId: string | null;
  articleSlug: string | null;
} {
  const path = pathname.replace(/\/$/, "") || "/";
  return {
    studentId:
      matchStudentId(path, "/family/students") ??
      matchStudentId(path, "/family/progress"),
    articleSlug: path.startsWith("/help/")
      ? path.slice("/help/".length).split("/")[0] || null
      : null,
  };
}
