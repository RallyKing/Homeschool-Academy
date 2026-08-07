import type { AgeBand } from "./types";
import { ageBandLabel } from "./types";

export type StudentStatsSnapshot = {
  displayName: string;
  academicLevel?: string;
  ageBand: AgeBand;
  xp: number;
  level: number;
  points: number;
  stars: number;
  currentStreak: number;
  totalLogs: number;
  totalChoresCompleted: number;
  totalMinutesLogged: number;
  distinctSubjectsLogged: number;
  existingBadgeKeys: string[];
};

export type MockBadgeProposal = {
  key: string;
  title: string;
  description: string;
  iconHint: string;
  criteriaSummary: string;
  ageBand: string;
};

export function mockBadgeProposals(
  stats: StudentStatsSnapshot,
): MockBadgeProposal[] {
  const band = stats.ageBand;
  const bandNote = ageBandLabel(band);
  const name = stats.displayName.split(" ")[0] || "Learner";
  const proposals: MockBadgeProposal[] = [];

  const tone =
    band === "early_elementary"
      ? "playful and concrete"
      : band === "teen"
        ? "grown-up and skill-focused"
        : "encouraging and clear";

  if (
    stats.currentStreak >= 3 &&
    !stats.existingBadgeKeys.includes("ai_streak_spark")
  ) {
    proposals.push({
      key: `ai_streak_${stats.level}_${band}`,
      title:
        band === "early_elementary"
          ? `${name}'s Streak Sparkles`
          : "Consistency Champion",
      description: `A ${tone} badge for keeping a ${stats.currentStreak}-day learning streak (${bandNote}).`,
      iconHint: "flame",
      criteriaSummary: `Earn with a ${Math.max(3, stats.currentStreak)}-day activity streak`,
      ageBand: band,
    });
  }

  if (
    stats.totalLogs >= 5 &&
    !stats.existingBadgeKeys.includes("ai_log_explorer")
  ) {
    proposals.push({
      key: `ai_logs_${stats.totalLogs}_${band}`,
      title:
        band === "early_elementary" ? "Learning Log Stickers" : "Ledger Explorer",
      description: `Celebrates ${stats.totalLogs} learning logs — age-fit for ${bandNote}.`,
      iconHint: "book",
      criteriaSummary: `Reach ${Math.max(5, stats.totalLogs)} verified or logged sessions`,
      ageBand: band,
    });
  }

  if (
    stats.totalChoresCompleted >= 2 &&
    !stats.existingBadgeKeys.some((k) => k.startsWith("ai_chore"))
  ) {
    proposals.push({
      key: `ai_chore_${stats.totalChoresCompleted}_${band}`,
      title: band === "teen" ? "Home Contribution" : "Helper Hero",
      description: `Recognizes helpful chores at home (${stats.totalChoresCompleted} done) — ${tone}.`,
      iconHint: "sparkle",
      criteriaSummary: `Complete ${Math.max(2, stats.totalChoresCompleted)} chores`,
      ageBand: band,
    });
  }

  if (proposals.length === 0) {
    proposals.push({
      key: `ai_welcome_${band}_${stats.level}`,
      title:
        band === "early_elementary"
          ? "First Steps Star"
          : `${stats.academicLevel ?? "Level"} Growth Badge`,
      description: `A customized starter badge for ${name} at level ${stats.level} (${bandNote}). Parent-approved, non-competitive.`,
      iconHint: "star",
      criteriaSummary: "Manual grant after parent accepts this proposal",
      ageBand: band,
    });
  }

  // Cap narrowly — AI should propose a few focused badges, not a flood
  return proposals.slice(0, 4);
}

export function mockCourseAssistAnswer(args: {
  courseTitle: string;
  question: string;
  academicLevel?: string;
}): string {
  return `[Course assist · demo] For "${args.courseTitle}"${
    args.academicLevel ? ` (${args.academicLevel})` : ""
  }:\n\nYou asked: "${args.question.slice(0, 180)}"\n\n1. Restate the question in your own words.\n2. Find one example already in your notes or lesson.\n3. Try one small practice step, then check with a parent.\n\nStay on this course topic only — no competition comparisons.`;
}

export function mockFamilyRecommendations(args: {
  studentCount: number;
  courseCount: number;
  openChores: number;
  totalLogs: number;
}): Array<{
  area: string;
  title: string;
  detail: string;
  priority: "low" | "medium" | "high";
}> {
  const out: Array<{
    area: string;
    title: string;
    detail: string;
    priority: "low" | "medium" | "high";
  }> = [];

  if (args.courseCount === 0) {
    out.push({
      area: "courses",
      title: "Add a first course",
      detail:
        "Start with one native or external course so the planner and ledger have something to track.",
      priority: "high",
    });
  } else if (args.totalLogs < args.studentCount * 3) {
    out.push({
      area: "logging",
      title: "Build a light logging habit",
      detail:
        "Aim for a few short verified logs per child each week — consistency beats long sessions.",
      priority: "medium",
    });
  }

  if (args.openChores > args.studentCount * 4) {
    out.push({
      area: "chores",
      title: "Trim chore load",
      detail:
        "Open chores look heavy relative to family size. Keep 2–3 active per child to avoid overwhelm.",
      priority: "medium",
    });
  } else {
    out.push({
      area: "balance",
      title: "Protect subject balance",
      detail:
        "Rotate STEM, humanities, and life skills across the week so no single subject crowds the plan.",
      priority: "low",
    });
  }

  out.push({
    area: "schedule",
    title: "Keep one buffer block",
    detail:
      "Leave a flexible block each week for catch-up or interest-led learning — not medical advice, just pacing.",
    priority: "low",
  });

  return out.slice(0, 5);
}

export function mockChildRecommendations(args: {
  displayName: string;
  ageBand: AgeBand;
  academicLevel?: string;
  level: number;
  distinctSubjects: number;
  currentStreak: number;
}): Array<{
  area: string;
  title: string;
  detail: string;
  priority: "low" | "medium" | "high";
}> {
  const band = ageBandLabel(args.ageBand);
  const name = args.displayName.split(" ")[0] || "Your learner";
  const out: Array<{
    area: string;
    title: string;
    detail: string;
    priority: "low" | "medium" | "high";
  }> = [
    {
      area: "learning",
      title:
        args.ageBand === "early_elementary"
          ? `Short playful sessions for ${name}`
          : `Focus blocks for ${name}`,
      detail:
        args.ageBand === "early_elementary"
          ? `At ${band}, prefer 15–20 minute bursts with movement breaks. Level ${args.level} is a celebration rung, not a race.`
          : `Match ${args.academicLevel ?? "current"} work to ${band}: one deep focus block, then a lighter creative or life-skill block.`,
      priority: "high",
    },
  ];

  if (args.distinctSubjects < 2) {
    out.push({
      area: "subjects",
      title: "Widen subject exposure gently",
      detail:
        "Add one complementary subject this month (e.g. reading with STEM, or life skills with humanities).",
      priority: "medium",
    });
  }

  if (args.currentStreak < 2) {
    out.push({
      area: "habits",
      title: "Tiny daily win",
      detail:
        "A 10-minute logged activity three days in a row builds momentum without pressure or sibling comparison.",
      priority: "medium",
    });
  } else {
    out.push({
      area: "habits",
      title: "Protect the streak kindly",
      detail: `${name} has a ${args.currentStreak}-day streak — celebrate the habit, not ranking against others.`,
      priority: "low",
    });
  }

  return out.slice(0, 4);
}
