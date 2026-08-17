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

export function mockReadAlongStory(args: {
  displayName: string;
  ageBand: AgeBand;
  academicLevel?: string;
  subject?: string;
}): { title: string; body: string } {
  const name = args.displayName.split(" ")[0] || "Sam";
  const topic = args.subject?.trim() || "everyday adventure";

  if (args.ageBand === "early_elementary") {
    return {
      title: `${name} and the Red Ball`,
      body: `${name} had a small red ball. The ball sat on the mat. ${name} gave it a tap. Tap, tap, tap! The ball rolled to the cat. The cat gave it a pat. Then the ball rolled to the sunlit path. ${name} ran and got the ball. "I did it!" said ${name}. The cat sat. The ball was still. It was a good, quiet day to play and rest.`,
    };
  }

  if (args.ageBand === "elementary") {
    return {
      title: `The Garden Map`,
      body: `${name} found a folded paper in the kitchen drawer. It was a map of the backyard garden, with a tiny X by the old oak. After lunch, ${name} followed the path past tomatoes, mint, and a sleepy bee. Under a flat stone by the oak, there was a tin box. Inside was a note: "Leave something kind for the next explorer." ${name} drew a picture of the garden, tucked it in the tin box, and put the stone back. The topic of ${topic} could wait. Today was for noticing.`,
    };
  }

  if (args.ageBand === "middle") {
    return {
      title: `Signals on the Creek`,
      body: `${name} tested a homemade water wheel at the creek behind the house. The first try jammed on a stick. The second spun, then wobbled. ${name} sketched the problem, swapped a smoother axle, and tried again. Neighbors walking dogs paused to watch. "It's for a ${topic} project," ${name} explained, "but mostly I wanted to see if it would work." When the wheel finally turned steadily, ${name} logged the time, the materials, and one honest sentence: failure taught the next step. Then ${name} packed up so the creek could keep its quiet.`,
    };
  }

  return {
    title: `A Quiet Hypothesis`,
    body: `${name} wanted a ${topic} essay that did not sound like a race against anyone else. So ${name} spent a morning collecting small facts: how long the bread took to rise, which pages of the lab notebook were actually useful, and what the family garden taught about patience. The draft began with a question, not a boast. Evidence came next, then a limitation: one backyard is not the whole world. By evening ${name} had a piece that a parent could discuss at the table — curious, careful, and finished without comparing siblings. That was the real experiment.`,
  };
}

const MOCK_VOCAB: Record<string, { definition: string; example: string }> = {
  adventure: {
    definition: "An adventure is a trip or experience that feels new and a little exciting.",
    example: "Reading a new story can feel like a small adventure.",
  },
  garden: {
    definition: "A garden is a place where people grow plants, flowers, or food.",
    example: "Tomatoes and mint can grow in a garden.",
  },
  map: {
    definition: "A map is a drawing that shows where places are.",
    example: "A map can help you find the oak tree in the yard.",
  },
  hypothesis: {
    definition: "A hypothesis is a careful guess you can test with evidence.",
    example: "A scientist writes a hypothesis before the experiment.",
  },
  axle: {
    definition: "An axle is a rod that a wheel turns around.",
    example: "A smoother axle helped the water wheel spin.",
  },
  explorer: {
    definition: "An explorer is someone who looks carefully to learn about a place.",
    example: "The note asked the next explorer to leave something kind.",
  },
};

export function mockVocabExplain(args: {
  word: string;
  ageBand: AgeBand;
}): { definition: string; example: string } {
  const key = args.word.toLowerCase().replace(/[^a-z0-9']/g, "");
  const known = MOCK_VOCAB[key];
  if (known) return known;

  const simple =
    args.ageBand === "early_elementary" || args.ageBand === "elementary";
  if (simple) {
    return {
      definition: `"${args.word}" is a word you can learn. It names something you can think about or do.`,
      example: `Try using "${args.word}" in a short sentence of your own.`,
    };
  }
  return {
    definition: `"${args.word}" is a vocabulary word from this story. Use context around it to infer the meaning, then check with a parent if you are unsure.`,
    example: `Reread the sentence that contains "${args.word}" and replace it with a synonym to test the meaning.`,
  };
}
