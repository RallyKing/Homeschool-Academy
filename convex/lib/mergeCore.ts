import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { levelFromXp } from "./gamificationCore";
import { participantKey } from "./socialCore";

/**
 * De-duplication engine for schools (families), students, and contacts.
 *
 * Every routine takes a `dryRun` flag. When set, the traversal runs against the
 * pre-merge state and only tallies what *would* change — no writes happen — so
 * the admin UI can preview a merge. Because of that, each routine reads the
 * rows it needs up front and reasons about the post-merge set in memory instead
 * of re-querying after a repoint.
 */

export type MergeLedger = {
  /** table -> rows repointed to the surviving parent */
  moved: Record<string, number>;
  /** table -> rows folded into a surviving sibling row */
  merged: Record<string, number>;
  /** table -> rows removed */
  deleted: Record<string, number>;
  warnings: string[];
};

export type StudentMergeSummary = {
  keptStudentId: Id<"students">;
  keptName: string;
  removedStudentId: Id<"students">;
  removedName: string;
};

export type ContactMergeSummary = {
  keptContactId: Id<"contacts">;
  removedContactId: Id<"contacts">;
  displayName: string;
};

export type MemberMergeSummary = {
  userId: Id<"users">;
  schoolRole: "main" | "admin" | "regular";
};

export type KeepName = "target" | "source" | "custom";

export function newLedger(): MergeLedger {
  return { moved: {}, merged: {}, deleted: {}, warnings: [] };
}

function bump(rec: Record<string, number>, key: string, n = 1): void {
  if (n <= 0) return;
  rec[key] = (rec[key] ?? 0) + n;
}

export function noteMoved(l: MergeLedger, table: string, n = 1): void {
  bump(l.moved, table, n);
}

export function noteMerged(l: MergeLedger, table: string, n = 1): void {
  bump(l.merged, table, n);
}

export function noteDeleted(l: MergeLedger, table: string, n = 1): void {
  bump(l.deleted, table, n);
}

/** Case/whitespace-insensitive key used for name-based duplicate detection. */
export function normalizeName(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

const SCHOOL_ROLE_RANK: Record<"main" | "admin" | "regular", number> = {
  main: 3,
  admin: 2,
  regular: 1,
};

/** main > admin > regular, so a merge never silently demotes a parent. */
function higherSchoolRole(
  a: "main" | "admin" | "regular" | undefined,
  b: "main" | "admin" | "regular" | undefined,
): "main" | "admin" | "regular" {
  const left = a ?? "regular";
  const right = b ?? "regular";
  return SCHOOL_ROLE_RANK[left] >= SCHOOL_ROLE_RANK[right] ? left : right;
}

const CONTACT_KIND_RANK: Record<Doc<"contacts">["kind"], number> = {
  school: 6,
  parent: 5,
  teacher: 4,
  tutor: 3,
  student: 2,
  user: 1,
};

function unionStrings(a: string[], b: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const value of [...a, ...b]) {
    const key = value.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(value.trim());
  }
  return out;
}

function floor0(n: number): number {
  return Math.max(0, n);
}

// ── contacts ────────────────────────────────────────────────────────────

/**
 * Fold `loser` into `winner`: union emails/phones, fill missing associations,
 * move student/course links, then drop the loser row.
 */
export async function mergeContactRows(
  ctx: MutationCtx,
  args: {
    winner: Doc<"contacts">;
    loser: Doc<"contacts">;
    ledger: MergeLedger;
    dryRun: boolean;
  },
): Promise<void> {
  const { winner, loser, ledger, dryRun } = args;
  if (winner._id === loser._id) return;

  const kind =
    CONTACT_KIND_RANK[winner.kind] >= CONTACT_KIND_RANK[loser.kind]
      ? winner.kind
      : loser.kind;

  const notes =
    winner.notes && loser.notes && winner.notes !== loser.notes
      ? `${winner.notes}\n${loser.notes}`
      : (winner.notes ?? loser.notes);

  if (!dryRun) {
    await ctx.db.patch("contacts", winner._id, {
      kind,
      displayName: winner.displayName.trim() || loser.displayName.trim(),
      emails: unionStrings(winner.emails, loser.emails),
      phones: unionStrings(winner.phones, loser.phones),
      notes,
      roleLabel: winner.roleLabel ?? loser.roleLabel,
      familyId: winner.familyId ?? loser.familyId,
      userId: winner.userId ?? loser.userId,
      studentId: winner.studentId ?? loser.studentId,
      academyId: winner.academyId ?? loser.academyId,
      updatedAt: Date.now(),
    });
  }

  const winnerStudentLinks = await ctx.db
    .query("contactStudentLinks")
    .withIndex("by_contact", (q) => q.eq("contactId", winner._id))
    .collect();
  const winnerStudentIds = new Set(
    winnerStudentLinks.map((l) => l.studentId as string),
  );
  const loserStudentLinks = await ctx.db
    .query("contactStudentLinks")
    .withIndex("by_contact", (q) => q.eq("contactId", loser._id))
    .collect();
  for (const link of loserStudentLinks) {
    if (winnerStudentIds.has(link.studentId)) {
      if (!dryRun) await ctx.db.delete("contactStudentLinks", link._id);
      noteDeleted(ledger, "contactStudentLinks");
      continue;
    }
    winnerStudentIds.add(link.studentId);
    if (!dryRun) {
      await ctx.db.patch("contactStudentLinks", link._id, {
        contactId: winner._id,
        familyId: winner.familyId ?? link.familyId,
      });
    }
    noteMoved(ledger, "contactStudentLinks");
  }

  const winnerCourseLinks = await ctx.db
    .query("contactCourseLinks")
    .withIndex("by_contact", (q) => q.eq("contactId", winner._id))
    .collect();
  const winnerCourseIds = new Set(
    winnerCourseLinks.map((l) => l.courseId as string),
  );
  const loserCourseLinks = await ctx.db
    .query("contactCourseLinks")
    .withIndex("by_contact", (q) => q.eq("contactId", loser._id))
    .collect();
  for (const link of loserCourseLinks) {
    if (winnerCourseIds.has(link.courseId)) {
      if (!dryRun) await ctx.db.delete("contactCourseLinks", link._id);
      noteDeleted(ledger, "contactCourseLinks");
      continue;
    }
    winnerCourseIds.add(link.courseId);
    if (!dryRun) {
      await ctx.db.patch("contactCourseLinks", link._id, {
        contactId: winner._id,
        familyId: winner.familyId ?? link.familyId,
      });
    }
    noteMoved(ledger, "contactCourseLinks");
  }

  if (!dryRun) await ctx.db.delete("contacts", loser._id);
  noteMerged(ledger, "contacts");
  noteDeleted(ledger, "contacts");
}

/** Prefer the family-scoped, most specific, oldest row as the survivor. */
function pickContactWinner(rows: Doc<"contacts">[]): Doc<"contacts"> {
  return rows.reduce((best, row) => {
    const bestScore = (best.familyId ? 10 : 0) + CONTACT_KIND_RANK[best.kind];
    const rowScore = (row.familyId ? 10 : 0) + CONTACT_KIND_RANK[row.kind];
    if (rowScore !== bestScore) return rowScore > bestScore ? row : best;
    return row.createdAt < best.createdAt ? row : best;
  });
}

/**
 * One contact card per person/school inside a family. Also folds in the
 * person's family-less "user" contact so the directory stops showing the same
 * human twice. Contacts belonging to *other* families are never touched.
 */
async function dedupeContactsForFamily(
  ctx: MutationCtx,
  args: {
    familyId: Id<"families">;
    extraContacts: Doc<"contacts">[];
    ledger: MergeLedger;
    dryRun: boolean;
  },
): Promise<ContactMergeSummary[]> {
  const { familyId, extraContacts, ledger, dryRun } = args;

  const familyContacts = await ctx.db
    .query("contacts")
    .withIndex("by_family", (q) => q.eq("familyId", familyId))
    .collect();

  const pool: Doc<"contacts">[] = [...familyContacts];
  const seen = new Set(pool.map((c) => c._id as string));
  for (const contact of extraContacts) {
    if (seen.has(contact._id)) continue;
    seen.add(contact._id);
    pool.push(contact);
  }

  // Pull in each person's family-less contact rows (kind "user" etc.).
  for (const contact of [...pool]) {
    if (!contact.userId) continue;
    const byUser = await ctx.db
      .query("contacts")
      .withIndex("by_user", (q) => q.eq("userId", contact.userId))
      .collect();
    for (const row of byUser) {
      if (seen.has(row._id)) continue;
      if (row.familyId !== undefined && row.familyId !== familyId) continue;
      seen.add(row._id);
      pool.push(row);
    }
  }

  const groups = new Map<string, Doc<"contacts">[]>();
  for (const contact of pool) {
    let key: string;
    if (contact.studentId) key = `student:${contact.studentId}`;
    else if (contact.userId) key = `user:${contact.userId}`;
    else if (contact.kind === "school") key = `school:${familyId}`;
    else key = `name:${contact.kind}:${normalizeName(contact.displayName)}`;

    const bucket = groups.get(key);
    if (bucket) bucket.push(contact);
    else groups.set(key, [contact]);
  }

  const merges: ContactMergeSummary[] = [];
  for (const rows of groups.values()) {
    if (rows.length < 2) continue;
    const winner = pickContactWinner(rows);
    for (const loser of rows) {
      if (loser._id === winner._id) continue;
      await mergeContactRows(ctx, { winner, loser, ledger, dryRun });
      merges.push({
        keptContactId: winner._id,
        removedContactId: loser._id,
        displayName: winner.displayName,
      });
    }
  }
  return merges;
}

// ── students ────────────────────────────────────────────────────────────

type AwardAdjust = {
  xp: number;
  points: number;
  stars: number;
  logs: number;
  chores: number;
  minutes: number;
  subjects: number;
};

function emptyAdjust(): AwardAdjust {
  return { xp: 0, points: 0, stars: 0, logs: 0, chores: 0, minutes: 0, subjects: 0 };
}

/**
 * Repoint the loser student's rows onto the winner, then delete the loser.
 * Both students must already live in the same family.
 */
export async function mergeStudentRows(
  ctx: MutationCtx,
  args: {
    winner: Doc<"students">;
    loser: Doc<"students">;
    ledger: MergeLedger;
    dryRun: boolean;
  },
): Promise<void> {
  const { winner, loser, ledger, dryRun } = args;
  if (winner._id === loser._id) {
    throw new Error("Cannot merge a student into itself");
  }
  if (winner.familyId !== loser.familyId) {
    throw new Error("Students must belong to the same school to be merged");
  }

  const familyId = winner.familyId;
  const winnerId = winner._id;
  const loserId = loser._id;

  // ── learning records ──
  const logs = await ctx.db
    .query("logs")
    .withIndex("by_student", (q) => q.eq("studentId", loserId))
    .collect();
  for (const log of logs) {
    if (!dryRun) await ctx.db.patch("logs", log._id, { studentId: winnerId });
    noteMoved(ledger, "logs");
  }

  const schedules = await ctx.db
    .query("schedules")
    .withIndex("by_student", (q) => q.eq("studentId", loserId))
    .collect();
  for (const schedule of schedules) {
    if (!dryRun) {
      await ctx.db.patch("schedules", schedule._id, { studentId: winnerId });
    }
    noteMoved(ledger, "schedules");
  }

  const chores = await ctx.db
    .query("chores")
    .withIndex("by_student", (q) => q.eq("studentId", loserId))
    .collect();
  for (const chore of chores) {
    if (!dryRun) {
      await ctx.db.patch("chores", chore._id, {
        studentId: winnerId,
        familyId,
      });
    }
    noteMoved(ledger, "chores");
  }

  const alerts = await ctx.db
    .query("alerts")
    .withIndex("by_student", (q) => q.eq("studentId", loserId))
    .collect();
  for (const alert of alerts) {
    if (!dryRun) {
      await ctx.db.patch("alerts", alert._id, { studentId: winnerId });
    }
    noteMoved(ledger, "alerts");
  }

  // ── gamification ──
  const winnerBadges = await ctx.db
    .query("studentBadges")
    .withIndex("by_student", (q) => q.eq("studentId", winnerId))
    .collect();
  const heldBadgeIds = new Map(
    winnerBadges.map((b) => [b.badgeId as string, b]),
  );
  const loserBadges = await ctx.db
    .query("studentBadges")
    .withIndex("by_student", (q) => q.eq("studentId", loserId))
    .collect();
  for (const row of loserBadges) {
    const held = heldBadgeIds.get(row.badgeId);
    if (held) {
      // Union of badges: keep the earliest earn date, drop the duplicate.
      if (!dryRun && row.earnedAt < held.earnedAt) {
        await ctx.db.patch("studentBadges", held._id, {
          earnedAt: row.earnedAt,
        });
      }
      if (!dryRun) await ctx.db.delete("studentBadges", row._id);
      noteMerged(ledger, "studentBadges");
      noteDeleted(ledger, "studentBadges");
      continue;
    }
    heldBadgeIds.set(row.badgeId, row);
    if (!dryRun) {
      await ctx.db.patch("studentBadges", row._id, { studentId: winnerId });
    }
    noteMoved(ledger, "studentBadges");
  }

  // Award ledger: the same source must never be counted twice.
  const winnerAwards = await ctx.db
    .query("gamificationAwards")
    .withIndex("by_student", (q) => q.eq("studentId", winnerId))
    .collect();
  const awardKeys = new Set(
    winnerAwards.map((a) => `${a.sourceType}:${a.sourceId}`),
  );
  const loserAwards = await ctx.db
    .query("gamificationAwards")
    .withIndex("by_student", (q) => q.eq("studentId", loserId))
    .collect();
  const dupAdjust = emptyAdjust();
  for (const award of loserAwards) {
    const key = `${award.sourceType}:${award.sourceId}`;
    if (awardKeys.has(key)) {
      if (award.reversedAt === undefined) {
        dupAdjust.xp += award.xp;
        dupAdjust.points += award.points;
        dupAdjust.stars += award.stars;
        dupAdjust.logs += award.logIncrement ?? 0;
        dupAdjust.chores += award.choreIncrement ?? 0;
        dupAdjust.minutes += award.minutesIncrement ?? 0;
        if (award.newSubject) dupAdjust.subjects += 1;
      }
      if (!dryRun) await ctx.db.delete("gamificationAwards", award._id);
      noteMerged(ledger, "gamificationAwards");
      noteDeleted(ledger, "gamificationAwards");
      continue;
    }
    awardKeys.add(key);
    if (!dryRun) {
      await ctx.db.patch("gamificationAwards", award._id, {
        studentId: winnerId,
        familyId,
      });
    }
    noteMoved(ledger, "gamificationAwards");
  }

  const winnerProfile = await ctx.db
    .query("studentGamification")
    .withIndex("by_student", (q) => q.eq("studentId", winnerId))
    .unique();
  const loserProfile = await ctx.db
    .query("studentGamification")
    .withIndex("by_student", (q) => q.eq("studentId", loserId))
    .unique();

  if (loserProfile && !winnerProfile) {
    if (!dryRun) {
      await ctx.db.patch("studentGamification", loserProfile._id, {
        studentId: winnerId,
        familyId,
        updatedAt: Date.now(),
      });
    }
    noteMoved(ledger, "studentGamification");
  } else if (loserProfile && winnerProfile) {
    const xp = floor0(winnerProfile.xp + loserProfile.xp - dupAdjust.xp);
    const points = floor0(
      winnerProfile.points + loserProfile.points - dupAdjust.points,
    );
    const stars = floor0(
      winnerProfile.stars + loserProfile.stars - dupAdjust.stars,
    );

    // Weekly buckets only add up when both rows track the same week.
    const sameWeek =
      winnerProfile.weekStart !== undefined &&
      winnerProfile.weekStart === loserProfile.weekStart;
    const newerWeekly =
      (loserProfile.weekStart ?? "") > (winnerProfile.weekStart ?? "")
        ? loserProfile
        : winnerProfile;

    if (!dryRun) {
      await ctx.db.patch("studentGamification", winnerProfile._id, {
        familyId,
        xp,
        points,
        stars,
        level: levelFromXp(xp),
        currentStreak: Math.max(
          winnerProfile.currentStreak,
          loserProfile.currentStreak,
        ),
        longestStreak: Math.max(
          winnerProfile.longestStreak,
          loserProfile.longestStreak,
        ),
        lastCompletionDate:
          (loserProfile.lastCompletionDate ?? "") >
          (winnerProfile.lastCompletionDate ?? "")
            ? loserProfile.lastCompletionDate
            : winnerProfile.lastCompletionDate,
        streakFreezes: Math.max(
          winnerProfile.streakFreezes,
          loserProfile.streakFreezes,
        ),
        weeklyXp: sameWeek
          ? floor0(
              winnerProfile.weeklyXp + loserProfile.weeklyXp - dupAdjust.xp,
            )
          : newerWeekly.weeklyXp,
        weeklyPoints: sameWeek
          ? floor0(
              winnerProfile.weeklyPoints +
                loserProfile.weeklyPoints -
                dupAdjust.points,
            )
          : newerWeekly.weeklyPoints,
        weeklyStars: sameWeek
          ? floor0(
              winnerProfile.weeklyStars +
                loserProfile.weeklyStars -
                dupAdjust.stars,
            )
          : newerWeekly.weeklyStars,
        weekStart: newerWeekly.weekStart,
        totalLogs: floor0(
          winnerProfile.totalLogs + loserProfile.totalLogs - dupAdjust.logs,
        ),
        totalChoresCompleted: floor0(
          winnerProfile.totalChoresCompleted +
            loserProfile.totalChoresCompleted -
            dupAdjust.chores,
        ),
        totalMinutesLogged: floor0(
          winnerProfile.totalMinutesLogged +
            loserProfile.totalMinutesLogged -
            dupAdjust.minutes,
        ),
        // Distinct subjects can't be summed reliably; take the larger count.
        distinctSubjectsLogged: Math.max(
          winnerProfile.distinctSubjectsLogged,
          loserProfile.distinctSubjectsLogged,
        ),
        updatedAt: Date.now(),
      });
      await ctx.db.delete("studentGamification", loserProfile._id);
    }
    noteMerged(ledger, "studentGamification");
    noteDeleted(ledger, "studentGamification");
  }

  const accolades = await ctx.db
    .query("accolades")
    .withIndex("by_student", (q) => q.eq("studentId", loserId))
    .collect();
  for (const row of accolades) {
    if (!dryRun) {
      await ctx.db.patch("accolades", row._id, {
        studentId: winnerId,
        familyId,
      });
    }
    noteMoved(ledger, "accolades");
  }

  const proposals = await ctx.db
    .query("badgeProposals")
    .withIndex("by_student", (q) => q.eq("studentId", loserId))
    .collect();
  for (const row of proposals) {
    if (!dryRun) {
      await ctx.db.patch("badgeProposals", row._id, {
        studentId: winnerId,
        familyId,
      });
    }
    noteMoved(ledger, "badgeProposals");
  }

  const redemptions = await ctx.db
    .query("rewardRedemptions")
    .withIndex("by_student", (q) => q.eq("studentId", loserId))
    .collect();
  for (const row of redemptions) {
    if (!dryRun) {
      await ctx.db.patch("rewardRedemptions", row._id, {
        studentId: winnerId,
        familyId,
      });
    }
    noteMoved(ledger, "rewardRedemptions");
  }

  const winnerQuests = await ctx.db
    .query("dailyQuests")
    .withIndex("by_student", (q) => q.eq("studentId", winnerId))
    .collect();
  const questIndex = new Map(
    winnerQuests.map((q) => [`${q.date}:${q.questKey}`, q]),
  );
  const loserQuests = await ctx.db
    .query("dailyQuests")
    .withIndex("by_student", (q) => q.eq("studentId", loserId))
    .collect();
  for (const quest of loserQuests) {
    const key = `${quest.date}:${quest.questKey}`;
    const held = questIndex.get(key);
    if (held) {
      const better =
        (quest.completed && !held.completed) ||
        quest.currentValue > held.currentValue;
      if (better && !dryRun) {
        await ctx.db.patch("dailyQuests", held._id, {
          currentValue: Math.max(held.currentValue, quest.currentValue),
          completed: held.completed || quest.completed,
          claimedAt: held.claimedAt ?? quest.claimedAt,
        });
      }
      if (!dryRun) await ctx.db.delete("dailyQuests", quest._id);
      noteMerged(ledger, "dailyQuests");
      noteDeleted(ledger, "dailyQuests");
      continue;
    }
    questIndex.set(key, quest);
    if (!dryRun) {
      await ctx.db.patch("dailyQuests", quest._id, {
        studentId: winnerId,
        familyId,
      });
    }
    noteMoved(ledger, "dailyQuests");
  }

  // ── social / feed ──
  const winnerStats = await ctx.db
    .query("studentSocialStats")
    .withIndex("by_student", (q) => q.eq("studentId", winnerId))
    .unique();
  const loserStats = await ctx.db
    .query("studentSocialStats")
    .withIndex("by_student", (q) => q.eq("studentId", loserId))
    .unique();
  if (loserStats && !winnerStats) {
    if (!dryRun) {
      await ctx.db.patch("studentSocialStats", loserStats._id, {
        studentId: winnerId,
        familyId,
        updatedAt: Date.now(),
      });
    }
    noteMoved(ledger, "studentSocialStats");
  } else if (loserStats && winnerStats) {
    if (!dryRun) {
      await ctx.db.patch("studentSocialStats", winnerStats._id, {
        familyId,
        kindnessGiven: winnerStats.kindnessGiven + loserStats.kindnessGiven,
        kindnessReceived:
          winnerStats.kindnessReceived + loserStats.kindnessReceived,
        stickersSent: winnerStats.stickersSent + loserStats.stickersSent,
        stickersReceived:
          winnerStats.stickersReceived + loserStats.stickersReceived,
        updatedAt: Date.now(),
      });
      await ctx.db.delete("studentSocialStats", loserStats._id);
    }
    noteMerged(ledger, "studentSocialStats");
    noteDeleted(ledger, "studentSocialStats");
  }

  const winnerUnlocks = await ctx.db
    .query("studentUnlocks")
    .withIndex("by_student", (q) => q.eq("studentId", winnerId))
    .collect();
  const unlockKeys = new Set(winnerUnlocks.map((u) => u.unlockKey));
  const loserUnlocks = await ctx.db
    .query("studentUnlocks")
    .withIndex("by_student", (q) => q.eq("studentId", loserId))
    .collect();
  for (const unlock of loserUnlocks) {
    if (unlockKeys.has(unlock.unlockKey)) {
      if (!dryRun) await ctx.db.delete("studentUnlocks", unlock._id);
      noteMerged(ledger, "studentUnlocks");
      noteDeleted(ledger, "studentUnlocks");
      continue;
    }
    unlockKeys.add(unlock.unlockKey);
    if (!dryRun) {
      await ctx.db.patch("studentUnlocks", unlock._id, {
        studentId: winnerId,
      });
    }
    noteMoved(ledger, "studentUnlocks");
  }

  const winnerCustom = await ctx.db
    .query("studentCustomization")
    .withIndex("by_student", (q) => q.eq("studentId", winnerId))
    .unique();
  const loserCustom = await ctx.db
    .query("studentCustomization")
    .withIndex("by_student", (q) => q.eq("studentId", loserId))
    .unique();
  if (loserCustom && !winnerCustom) {
    if (!dryRun) {
      await ctx.db.patch("studentCustomization", loserCustom._id, {
        studentId: winnerId,
        updatedAt: Date.now(),
      });
    }
    noteMoved(ledger, "studentCustomization");
  } else if (loserCustom && winnerCustom) {
    if (!dryRun) {
      await ctx.db.patch("studentCustomization", winnerCustom._id, {
        unlockedPackIds: unionStrings(
          winnerCustom.unlockedPackIds,
          loserCustom.unlockedPackIds,
        ),
        updatedAt: Date.now(),
      });
      await ctx.db.delete("studentCustomization", loserCustom._id);
    }
    noteMerged(ledger, "studentCustomization");
    noteDeleted(ledger, "studentCustomization");
  }

  const messages = await ctx.db
    .query("socialMessages")
    .withIndex("by_family", (q) => q.eq("familyId", familyId))
    .collect();
  for (const message of messages) {
    const from = message.fromStudentId === loserId ? winnerId : message.fromStudentId;
    const to = message.toStudentId === loserId ? winnerId : message.toStudentId;
    if (from === message.fromStudentId && to === message.toStudentId) continue;
    if (from === to) {
      // A note the child sent to their own duplicate profile is meaningless.
      if (!dryRun) await ctx.db.delete("socialMessages", message._id);
      noteDeleted(ledger, "socialMessages");
      continue;
    }
    if (!dryRun) {
      await ctx.db.patch("socialMessages", message._id, {
        fromStudentId: from,
        toStudentId: to,
      });
    }
    noteMoved(ledger, "socialMessages");
  }

  const threads = await ctx.db
    .query("socialThreads")
    .withIndex("by_family", (q) => q.eq("familyId", familyId))
    .collect();
  const threadByKey = new Map<string, Doc<"socialThreads">>();
  for (const thread of threads) {
    if (!thread.participantStudentIds.includes(loserId)) {
      threadByKey.set(thread.participantKey, thread);
    }
  }
  for (const thread of threads) {
    if (!thread.participantStudentIds.includes(loserId)) continue;

    const participants: Id<"students">[] = [];
    for (const id of thread.participantStudentIds) {
      const next = id === loserId ? winnerId : id;
      if (!participants.includes(next)) participants.push(next);
    }

    if (participants.length < 2) {
      const threadMessages = await ctx.db
        .query("socialMessages")
        .withIndex("by_thread", (q) => q.eq("threadId", thread._id))
        .collect();
      for (const message of threadMessages) {
        if (!dryRun) await ctx.db.delete("socialMessages", message._id);
        noteDeleted(ledger, "socialMessages");
      }
      if (!dryRun) await ctx.db.delete("socialThreads", thread._id);
      noteDeleted(ledger, "socialThreads");
      continue;
    }

    const key = participantKey(participants[0]!, participants[1]!);
    const existing = threadByKey.get(key);
    if (existing && existing._id !== thread._id) {
      const threadMessages = await ctx.db
        .query("socialMessages")
        .withIndex("by_thread", (q) => q.eq("threadId", thread._id))
        .collect();
      for (const message of threadMessages) {
        if (!dryRun) {
          await ctx.db.patch("socialMessages", message._id, {
            threadId: existing._id,
          });
        }
        noteMoved(ledger, "socialMessages");
      }
      if (!dryRun) {
        await ctx.db.patch("socialThreads", existing._id, {
          updatedAt: Math.max(existing.updatedAt, thread.updatedAt),
        });
        await ctx.db.delete("socialThreads", thread._id);
      }
      noteMerged(ledger, "socialThreads");
      noteDeleted(ledger, "socialThreads");
      continue;
    }

    threadByKey.set(key, thread);
    if (!dryRun) {
      await ctx.db.patch("socialThreads", thread._id, {
        participantStudentIds: participants,
        participantKey: key,
      });
    }
    noteMoved(ledger, "socialThreads");
  }

  const posts = await ctx.db
    .query("feedPosts")
    .withIndex("by_family", (q) => q.eq("familyId", familyId))
    .collect();
  for (const post of posts) {
    const mentions = post.mentionsStudentIds;
    const nextMentions = mentions?.includes(loserId)
      ? Array.from(
          new Set(mentions.map((id) => (id === loserId ? winnerId : id))),
        )
      : undefined;
    const touchesActor = post.actorStudentId === loserId;
    const touchesTarget = post.targetStudentId === loserId;
    if (!touchesActor && !touchesTarget && !nextMentions) continue;
    if (!dryRun) {
      await ctx.db.patch("feedPosts", post._id, {
        actorStudentId: touchesActor ? winnerId : post.actorStudentId,
        targetStudentId: touchesTarget ? winnerId : post.targetStudentId,
        mentionsStudentIds: nextMentions ?? post.mentionsStudentIds,
      });
    }
    noteMoved(ledger, "feedPosts");
  }

  const reactions = await ctx.db
    .query("feedReactions")
    .withIndex("by_family", (q) => q.eq("familyId", familyId))
    .collect();
  const heldReactions = new Set(
    reactions
      .filter((r) => r.actorStudentId === winnerId)
      .map((r) => `${r.postId}`),
  );
  for (const reaction of reactions) {
    if (reaction.actorStudentId !== loserId) continue;
    if (heldReactions.has(`${reaction.postId}`)) {
      // One reaction per student per post.
      if (!dryRun) await ctx.db.delete("feedReactions", reaction._id);
      noteMerged(ledger, "feedReactions");
      noteDeleted(ledger, "feedReactions");
      continue;
    }
    heldReactions.add(`${reaction.postId}`);
    if (!dryRun) {
      await ctx.db.patch("feedReactions", reaction._id, {
        actorStudentId: winnerId,
      });
    }
    noteMoved(ledger, "feedReactions");
  }

  const comments = await ctx.db
    .query("feedComments")
    .withIndex("by_family", (q) => q.eq("familyId", familyId))
    .collect();
  for (const comment of comments) {
    if (comment.authorStudentId !== loserId) continue;
    if (!dryRun) {
      await ctx.db.patch("feedComments", comment._id, {
        authorStudentId: winnerId,
      });
    }
    noteMoved(ledger, "feedComments");
  }

  // ── read-along ──
  const stories = await ctx.db
    .query("readAlongStories")
    .withIndex("by_student", (q) => q.eq("studentId", loserId))
    .collect();
  for (const story of stories) {
    if (!dryRun) {
      await ctx.db.patch("readAlongStories", story._id, {
        studentId: winnerId,
        familyId,
      });
    }
    noteMoved(ledger, "readAlongStories");
  }

  const sessions = await ctx.db
    .query("readAlongSessions")
    .withIndex("by_student", (q) => q.eq("studentId", loserId))
    .collect();
  for (const session of sessions) {
    if (!dryRun) {
      await ctx.db.patch("readAlongSessions", session._id, {
        studentId: winnerId,
        familyId,
      });
    }
    noteMoved(ledger, "readAlongSessions");
  }

  // ── access + contacts ──
  const winnerAccess = await ctx.db
    .query("teacherStudentAccess")
    .withIndex("by_student", (q) => q.eq("studentId", winnerId))
    .collect();
  const teacherIds = new Set(
    winnerAccess.map((row) => row.teacherUserId as string),
  );
  const loserAccess = await ctx.db
    .query("teacherStudentAccess")
    .withIndex("by_student", (q) => q.eq("studentId", loserId))
    .collect();
  for (const row of loserAccess) {
    if (teacherIds.has(row.teacherUserId)) {
      if (!dryRun) await ctx.db.delete("teacherStudentAccess", row._id);
      noteMerged(ledger, "teacherStudentAccess");
      noteDeleted(ledger, "teacherStudentAccess");
      continue;
    }
    teacherIds.add(row.teacherUserId);
    if (!dryRun) {
      await ctx.db.patch("teacherStudentAccess", row._id, {
        studentId: winnerId,
        familyId,
      });
    }
    noteMoved(ledger, "teacherStudentAccess");
  }

  const winnerLinks = await ctx.db
    .query("contactStudentLinks")
    .withIndex("by_student", (q) => q.eq("studentId", winnerId))
    .collect();
  const linkedContactIds = new Set(
    winnerLinks.map((l) => l.contactId as string),
  );
  const loserLinks = await ctx.db
    .query("contactStudentLinks")
    .withIndex("by_student", (q) => q.eq("studentId", loserId))
    .collect();
  for (const link of loserLinks) {
    if (linkedContactIds.has(link.contactId)) {
      if (!dryRun) await ctx.db.delete("contactStudentLinks", link._id);
      noteMerged(ledger, "contactStudentLinks");
      noteDeleted(ledger, "contactStudentLinks");
      continue;
    }
    linkedContactIds.add(link.contactId);
    if (!dryRun) {
      await ctx.db.patch("contactStudentLinks", link._id, {
        studentId: winnerId,
        familyId,
      });
    }
    noteMoved(ledger, "contactStudentLinks");
  }

  const winnerContact = await ctx.db
    .query("contacts")
    .withIndex("by_student", (q) => q.eq("studentId", winnerId))
    .first();
  const loserContacts = await ctx.db
    .query("contacts")
    .withIndex("by_student", (q) => q.eq("studentId", loserId))
    .collect();
  for (const contact of loserContacts) {
    if (winnerContact) {
      await mergeContactRows(ctx, {
        winner: winnerContact,
        loser: contact,
        ledger,
        dryRun,
      });
      continue;
    }
    if (!dryRun) {
      await ctx.db.patch("contacts", contact._id, {
        studentId: winnerId,
        familyId,
        updatedAt: Date.now(),
      });
    }
    noteMoved(ledger, "contacts");
  }

  // ── the student row itself ──
  const patch: {
    userId?: Id<"users">;
    birthYear?: number;
    academicLevel?: string;
    imageStorageId?: Id<"_storage">;
    defaultPublicCheer?: boolean;
    notifyKudos?: boolean;
    notifyChores?: boolean;
    notifyQuests?: boolean;
  } = {};

  if (!winner.userId && loser.userId) patch.userId = loser.userId;
  if (winner.userId && loser.userId && winner.userId !== loser.userId) {
    ledger.warnings.push(
      `Students "${winner.displayName}" and "${loser.displayName}" are linked to different login accounts; kept the surviving student's account and left the other user row untouched.`,
    );
  }
  if (winner.birthYear === undefined && loser.birthYear !== undefined) {
    patch.birthYear = loser.birthYear;
  }
  if (!winner.academicLevel && loser.academicLevel) {
    patch.academicLevel = loser.academicLevel;
  }
  const adoptPhoto = !winner.imageStorageId && Boolean(loser.imageStorageId);
  if (adoptPhoto && loser.imageStorageId) {
    patch.imageStorageId = loser.imageStorageId;
  }
  if (
    winner.defaultPublicCheer === undefined &&
    loser.defaultPublicCheer !== undefined
  ) {
    patch.defaultPublicCheer = loser.defaultPublicCheer;
  }
  if (winner.notifyKudos === undefined && loser.notifyKudos !== undefined) {
    patch.notifyKudos = loser.notifyKudos;
  }
  if (winner.notifyChores === undefined && loser.notifyChores !== undefined) {
    patch.notifyChores = loser.notifyChores;
  }
  if (winner.notifyQuests === undefined && loser.notifyQuests !== undefined) {
    patch.notifyQuests = loser.notifyQuests;
  }

  if (!dryRun) {
    if (Object.keys(patch).length > 0) {
      await ctx.db.patch("students", winnerId, patch);
    }
    if (loser.imageStorageId && !adoptPhoto) {
      await ctx.storage.delete(loser.imageStorageId);
    }
    await ctx.db.delete("students", loserId);
  }
  noteMerged(ledger, "students");
  noteDeleted(ledger, "students");
}

/** Prefer the student with a linked login, then the older record. */
function pickStudentWinner(rows: Doc<"students">[]): Doc<"students"> {
  return rows.reduce((best, row) => {
    const bestScore = best.userId ? 1 : 0;
    const rowScore = row.userId ? 1 : 0;
    if (bestScore !== rowScore) return rowScore > bestScore ? row : best;
    return row.createdAt < best.createdAt ? row : best;
  });
}

// ── families (schools) ──────────────────────────────────────────────────

export type FamilyMergeReport = {
  dryRun: boolean;
  sourceFamilyId: Id<"families">;
  sourceName: string;
  targetFamilyId: Id<"families">;
  targetName: string;
  survivingName: string;
  moved: Array<{ table: string; count: number }>;
  merged: Array<{ table: string; count: number }>;
  deleted: Array<{ table: string; count: number }>;
  studentMerges: StudentMergeSummary[];
  contactMerges: ContactMergeSummary[];
  memberMerges: MemberMergeSummary[];
  warnings: string[];
};

function toRows(rec: Record<string, number>): Array<{
  table: string;
  count: number;
}> {
  return Object.entries(rec)
    .map(([table, count]) => ({ table, count }))
    .sort((a, b) => b.count - a.count || a.table.localeCompare(b.table));
}

export function ledgerToRows(ledger: MergeLedger): {
  moved: Array<{ table: string; count: number }>;
  merged: Array<{ table: string; count: number }>;
  deleted: Array<{ table: string; count: number }>;
} {
  return {
    moved: toRows(ledger.moved),
    merged: toRows(ledger.merged),
    deleted: toRows(ledger.deleted),
  };
}

/**
 * Fold `sourceFamilyId` into `targetFamilyId`. Everything keyed by the source
 * family is repointed, duplicate parents/students/contacts/subjects/badges are
 * collapsed, and the source school row is removed.
 *
 * Runs inside a single Convex mutation, so the whole merge is transactional.
 * Convex mutations have a per-transaction read/write budget; a school with tens
 * of thousands of child rows would need to be paged through an internal
 * mutation loop instead. Current schools are far below that.
 */
export async function mergeFamiliesCore(
  ctx: MutationCtx,
  args: {
    sourceFamilyId: Id<"families">;
    targetFamilyId: Id<"families">;
    keepName: KeepName;
    customName?: string;
    dryRun: boolean;
  },
): Promise<FamilyMergeReport> {
  const { sourceFamilyId, targetFamilyId, dryRun } = args;

  if (sourceFamilyId === targetFamilyId) {
    throw new Error("Cannot merge a school into itself");
  }

  const source = await ctx.db.get("families", sourceFamilyId);
  if (!source) throw new Error("Source school not found");
  const target = await ctx.db.get("families", targetFamilyId);
  if (!target) throw new Error("Target school not found");

  const ledger = newLedger();

  let survivingName = target.name;
  if (args.keepName === "source") survivingName = source.name;
  if (args.keepName === "custom") {
    const custom = args.customName?.trim();
    if (!custom) throw new Error("A custom school name is required");
    survivingName = custom;
  }

  // ── parents ──
  const targetMembers = await ctx.db
    .query("familyMembers")
    .withIndex("by_family", (q) => q.eq("familyId", targetFamilyId))
    .collect();
  const memberByUser = new Map(
    targetMembers.map((m) => [m.userId as string, m]),
  );
  const sourceMembers = await ctx.db
    .query("familyMembers")
    .withIndex("by_family", (q) => q.eq("familyId", sourceFamilyId))
    .collect();
  const memberMerges: MemberMergeSummary[] = [];
  for (const member of sourceMembers) {
    const held = memberByUser.get(member.userId);
    if (held) {
      const schoolRole = higherSchoolRole(held.schoolRole, member.schoolRole);
      if (!dryRun) {
        await ctx.db.patch("familyMembers", held._id, {
          schoolRole,
          role: held.role === "parent" ? "parent" : member.role,
          createdAt: Math.min(held.createdAt, member.createdAt),
        });
        await ctx.db.delete("familyMembers", member._id);
      }
      noteMerged(ledger, "familyMembers");
      noteDeleted(ledger, "familyMembers");
      memberMerges.push({ userId: member.userId, schoolRole });
      continue;
    }
    memberByUser.set(member.userId, member);
    if (!dryRun) {
      await ctx.db.patch("familyMembers", member._id, {
        familyId: targetFamilyId,
      });
    }
    noteMoved(ledger, "familyMembers");
  }

  // ── staff ──
  const targetStaff = await ctx.db
    .query("schoolStaff")
    .withIndex("by_family", (q) => q.eq("familyId", targetFamilyId))
    .collect();
  const staffUserIds = new Set(targetStaff.map((s) => s.userId as string));
  const sourceStaff = await ctx.db
    .query("schoolStaff")
    .withIndex("by_family", (q) => q.eq("familyId", sourceFamilyId))
    .collect();
  for (const staff of sourceStaff) {
    if (staffUserIds.has(staff.userId)) {
      if (!dryRun) await ctx.db.delete("schoolStaff", staff._id);
      noteMerged(ledger, "schoolStaff");
      noteDeleted(ledger, "schoolStaff");
      continue;
    }
    staffUserIds.add(staff.userId);
    if (!dryRun) {
      await ctx.db.patch("schoolStaff", staff._id, {
        familyId: targetFamilyId,
      });
    }
    noteMoved(ledger, "schoolStaff");
  }

  // ── academy subscriptions ──
  const targetSubs = await ctx.db
    .query("familyAcademySubscriptions")
    .withIndex("by_family", (q) => q.eq("familyId", targetFamilyId))
    .collect();
  const subsByAcademy = new Map(
    targetSubs.map((s) => [s.academyId as string, s]),
  );
  const sourceSubs = await ctx.db
    .query("familyAcademySubscriptions")
    .withIndex("by_family", (q) => q.eq("familyId", sourceFamilyId))
    .collect();
  for (const sub of sourceSubs) {
    const held = subsByAcademy.get(sub.academyId);
    if (held) {
      if (held.status !== "active" && sub.status === "active" && !dryRun) {
        await ctx.db.patch("familyAcademySubscriptions", held._id, {
          status: "active",
          updatedAt: Date.now(),
        });
      }
      if (!dryRun) {
        await ctx.db.delete("familyAcademySubscriptions", sub._id);
      }
      noteMerged(ledger, "familyAcademySubscriptions");
      noteDeleted(ledger, "familyAcademySubscriptions");
      continue;
    }
    subsByAcademy.set(sub.academyId, sub);
    if (!dryRun) {
      await ctx.db.patch("familyAcademySubscriptions", sub._id, {
        familyId: targetFamilyId,
      });
    }
    noteMoved(ledger, "familyAcademySubscriptions");
  }

  // ── custom subjects (dedupe by name, repoint references) ──
  const targetSubjects = await ctx.db
    .query("subjects")
    .withIndex("by_family", (q) => q.eq("familyId", targetFamilyId))
    .collect();
  const subjectByName = new Map(
    targetSubjects.map((s) => [normalizeName(s.name), s]),
  );
  const sourceSubjects = await ctx.db
    .query("subjects")
    .withIndex("by_family", (q) => q.eq("familyId", sourceFamilyId))
    .collect();
  for (const subject of sourceSubjects) {
    const held = subjectByName.get(normalizeName(subject.name));
    if (held) {
      const courses = await ctx.db
        .query("courses")
        .withIndex("by_subject", (q) => q.eq("subjectId", subject._id))
        .collect();
      for (const course of courses) {
        if (!dryRun) {
          await ctx.db.patch("courses", course._id, { subjectId: held._id });
        }
        noteMoved(ledger, "courses");
      }
      const logs = await ctx.db
        .query("logs")
        .withIndex("by_subject", (q) => q.eq("subjectId", subject._id))
        .collect();
      for (const log of logs) {
        if (!dryRun) {
          await ctx.db.patch("logs", log._id, { subjectId: held._id });
        }
        noteMoved(ledger, "logs");
      }
      if (!dryRun) await ctx.db.delete("subjects", subject._id);
      noteMerged(ledger, "subjects");
      noteDeleted(ledger, "subjects");
      continue;
    }
    subjectByName.set(normalizeName(subject.name), subject);
    if (!dryRun) {
      await ctx.db.patch("subjects", subject._id, {
        familyId: targetFamilyId,
      });
    }
    noteMoved(ledger, "subjects");
  }

  // ── courses ──
  const sourceCourses = await ctx.db
    .query("courses")
    .withIndex("by_family", (q) => q.eq("familyId", sourceFamilyId))
    .collect();
  for (const course of sourceCourses) {
    if (!dryRun) {
      await ctx.db.patch("courses", course._id, { familyId: targetFamilyId });
    }
    noteMoved(ledger, "courses");
  }

  // ── custom badges (dedupe by key, repoint awarded rows) ──
  const targetBadges = await ctx.db
    .query("badges")
    .withIndex("by_family", (q) => q.eq("familyId", targetFamilyId))
    .collect();
  const badgeByKey = new Map(targetBadges.map((b) => [b.key, b]));
  const sourceBadges = await ctx.db
    .query("badges")
    .withIndex("by_family", (q) => q.eq("familyId", sourceFamilyId))
    .collect();
  for (const badge of sourceBadges) {
    const held = badgeByKey.get(badge.key);
    if (held) {
      const earned = await ctx.db
        .query("studentBadges")
        .withIndex("by_badge", (q) => q.eq("badgeId", badge._id))
        .collect();
      for (const row of earned) {
        const already = await ctx.db
          .query("studentBadges")
          .withIndex("by_student_and_badge", (q) =>
            q.eq("studentId", row.studentId).eq("badgeId", held._id),
          )
          .first();
        if (already) {
          if (!dryRun) await ctx.db.delete("studentBadges", row._id);
          noteDeleted(ledger, "studentBadges");
          continue;
        }
        if (!dryRun) {
          await ctx.db.patch("studentBadges", row._id, { badgeId: held._id });
        }
        noteMoved(ledger, "studentBadges");
      }
      const proposals = await ctx.db
        .query("badgeProposals")
        .withIndex("by_family", (q) => q.eq("familyId", sourceFamilyId))
        .collect();
      for (const proposal of proposals) {
        if (proposal.acceptedBadgeId !== badge._id) continue;
        if (!dryRun) {
          await ctx.db.patch("badgeProposals", proposal._id, {
            acceptedBadgeId: held._id,
          });
        }
        noteMoved(ledger, "badgeProposals");
      }
      if (!dryRun) await ctx.db.delete("badges", badge._id);
      noteMerged(ledger, "badges");
      noteDeleted(ledger, "badges");
      continue;
    }
    badgeByKey.set(badge.key, badge);
    if (!dryRun) {
      await ctx.db.patch("badges", badge._id, { familyId: targetFamilyId });
    }
    noteMoved(ledger, "badges");
  }

  // ── rewards ──
  const sourceRewards = await ctx.db
    .query("rewardCatalog")
    .withIndex("by_family", (q) => q.eq("familyId", sourceFamilyId))
    .collect();
  for (const reward of sourceRewards) {
    if (!dryRun) {
      await ctx.db.patch("rewardCatalog", reward._id, {
        familyId: targetFamilyId,
      });
    }
    noteMoved(ledger, "rewardCatalog");
  }

  const sourceRedemptions = await ctx.db
    .query("rewardRedemptions")
    .withIndex("by_family", (q) => q.eq("familyId", sourceFamilyId))
    .collect();
  for (const row of sourceRedemptions) {
    if (!dryRun) {
      await ctx.db.patch("rewardRedemptions", row._id, {
        familyId: targetFamilyId,
      });
    }
    noteMoved(ledger, "rewardRedemptions");
  }

  // ── per-student rollups that carry familyId ──
  const sourceGamification = await ctx.db
    .query("studentGamification")
    .withIndex("by_family", (q) => q.eq("familyId", sourceFamilyId))
    .collect();
  for (const row of sourceGamification) {
    if (!dryRun) {
      await ctx.db.patch("studentGamification", row._id, {
        familyId: targetFamilyId,
      });
    }
    noteMoved(ledger, "studentGamification");
  }

  const sourceAccolades = await ctx.db
    .query("accolades")
    .withIndex("by_family", (q) => q.eq("familyId", sourceFamilyId))
    .collect();
  for (const row of sourceAccolades) {
    if (!dryRun) {
      await ctx.db.patch("accolades", row._id, { familyId: targetFamilyId });
    }
    noteMoved(ledger, "accolades");
  }

  const sourceProposals = await ctx.db
    .query("badgeProposals")
    .withIndex("by_family", (q) => q.eq("familyId", sourceFamilyId))
    .collect();
  for (const row of sourceProposals) {
    if (!dryRun) {
      await ctx.db.patch("badgeProposals", row._id, {
        familyId: targetFamilyId,
      });
    }
    noteMoved(ledger, "badgeProposals");
  }

  const sourceQuests = await ctx.db
    .query("dailyQuests")
    .withIndex("by_family_and_date", (q) => q.eq("familyId", sourceFamilyId))
    .collect();
  for (const row of sourceQuests) {
    if (!dryRun) {
      await ctx.db.patch("dailyQuests", row._id, {
        familyId: targetFamilyId,
      });
    }
    noteMoved(ledger, "dailyQuests");
  }

  const sourceChores = await ctx.db
    .query("chores")
    .withIndex("by_family", (q) => q.eq("familyId", sourceFamilyId))
    .collect();
  for (const row of sourceChores) {
    if (!dryRun) {
      await ctx.db.patch("chores", row._id, { familyId: targetFamilyId });
    }
    noteMoved(ledger, "chores");
  }

  const sourceStats = await ctx.db
    .query("studentSocialStats")
    .withIndex("by_family", (q) => q.eq("familyId", sourceFamilyId))
    .collect();
  for (const row of sourceStats) {
    if (!dryRun) {
      await ctx.db.patch("studentSocialStats", row._id, {
        familyId: targetFamilyId,
      });
    }
    noteMoved(ledger, "studentSocialStats");
  }

  // ── social + feed ──
  const sourceThreads = await ctx.db
    .query("socialThreads")
    .withIndex("by_family", (q) => q.eq("familyId", sourceFamilyId))
    .collect();
  for (const row of sourceThreads) {
    if (!dryRun) {
      await ctx.db.patch("socialThreads", row._id, {
        familyId: targetFamilyId,
      });
    }
    noteMoved(ledger, "socialThreads");
  }

  const sourceMessages = await ctx.db
    .query("socialMessages")
    .withIndex("by_family", (q) => q.eq("familyId", sourceFamilyId))
    .collect();
  for (const row of sourceMessages) {
    if (!dryRun) {
      await ctx.db.patch("socialMessages", row._id, {
        familyId: targetFamilyId,
      });
    }
    noteMoved(ledger, "socialMessages");
  }

  const sourcePosts = await ctx.db
    .query("feedPosts")
    .withIndex("by_family", (q) => q.eq("familyId", sourceFamilyId))
    .collect();
  for (const row of sourcePosts) {
    if (!dryRun) {
      await ctx.db.patch("feedPosts", row._id, { familyId: targetFamilyId });
    }
    noteMoved(ledger, "feedPosts");
  }

  const sourceReactions = await ctx.db
    .query("feedReactions")
    .withIndex("by_family", (q) => q.eq("familyId", sourceFamilyId))
    .collect();
  for (const row of sourceReactions) {
    if (!dryRun) {
      await ctx.db.patch("feedReactions", row._id, {
        familyId: targetFamilyId,
      });
    }
    noteMoved(ledger, "feedReactions");
  }

  const sourceComments = await ctx.db
    .query("feedComments")
    .withIndex("by_family", (q) => q.eq("familyId", sourceFamilyId))
    .collect();
  for (const row of sourceComments) {
    if (!dryRun) {
      await ctx.db.patch("feedComments", row._id, {
        familyId: targetFamilyId,
      });
    }
    noteMoved(ledger, "feedComments");
  }

  const targetReads = await ctx.db
    .query("feedWallReads")
    .withIndex("by_family_and_user", (q) => q.eq("familyId", targetFamilyId))
    .collect();
  const readsByUser = new Map(targetReads.map((r) => [r.userId as string, r]));
  const sourceReads = await ctx.db
    .query("feedWallReads")
    .withIndex("by_family_and_user", (q) => q.eq("familyId", sourceFamilyId))
    .collect();
  for (const row of sourceReads) {
    const held = readsByUser.get(row.userId);
    if (held) {
      if (row.lastReadAt > held.lastReadAt && !dryRun) {
        await ctx.db.patch("feedWallReads", held._id, {
          lastReadAt: row.lastReadAt,
        });
      }
      if (!dryRun) await ctx.db.delete("feedWallReads", row._id);
      noteMerged(ledger, "feedWallReads");
      noteDeleted(ledger, "feedWallReads");
      continue;
    }
    readsByUser.set(row.userId, row);
    if (!dryRun) {
      await ctx.db.patch("feedWallReads", row._id, {
        familyId: targetFamilyId,
      });
    }
    noteMoved(ledger, "feedWallReads");
  }

  // ── alerts ──
  const sourceAlerts = await ctx.db
    .query("alerts")
    .withIndex("by_family", (q) => q.eq("familyId", sourceFamilyId))
    .collect();
  for (const row of sourceAlerts) {
    if (!dryRun) {
      await ctx.db.patch("alerts", row._id, { familyId: targetFamilyId });
    }
    noteMoved(ledger, "alerts");
  }

  // ── teacher scoping ──
  const targetStudentAccess = await ctx.db
    .query("teacherStudentAccess")
    .withIndex("by_family", (q) => q.eq("familyId", targetFamilyId))
    .collect();
  const studentAccessKeys = new Set(
    targetStudentAccess.map((r) => `${r.teacherUserId}:${r.studentId}`),
  );
  const sourceStudentAccess = await ctx.db
    .query("teacherStudentAccess")
    .withIndex("by_family", (q) => q.eq("familyId", sourceFamilyId))
    .collect();
  for (const row of sourceStudentAccess) {
    const key = `${row.teacherUserId}:${row.studentId}`;
    if (studentAccessKeys.has(key)) {
      if (!dryRun) await ctx.db.delete("teacherStudentAccess", row._id);
      noteMerged(ledger, "teacherStudentAccess");
      noteDeleted(ledger, "teacherStudentAccess");
      continue;
    }
    studentAccessKeys.add(key);
    if (!dryRun) {
      await ctx.db.patch("teacherStudentAccess", row._id, {
        familyId: targetFamilyId,
      });
    }
    noteMoved(ledger, "teacherStudentAccess");
  }

  const targetCourseAccess = await ctx.db
    .query("teacherCourseAccess")
    .withIndex("by_family", (q) => q.eq("familyId", targetFamilyId))
    .collect();
  const courseAccessKeys = new Set(
    targetCourseAccess.map((r) => `${r.teacherUserId}:${r.courseId}`),
  );
  const sourceCourseAccess = await ctx.db
    .query("teacherCourseAccess")
    .withIndex("by_family", (q) => q.eq("familyId", sourceFamilyId))
    .collect();
  for (const row of sourceCourseAccess) {
    const key = `${row.teacherUserId}:${row.courseId}`;
    if (courseAccessKeys.has(key)) {
      if (!dryRun) await ctx.db.delete("teacherCourseAccess", row._id);
      noteMerged(ledger, "teacherCourseAccess");
      noteDeleted(ledger, "teacherCourseAccess");
      continue;
    }
    courseAccessKeys.add(key);
    if (!dryRun) {
      await ctx.db.patch("teacherCourseAccess", row._id, {
        familyId: targetFamilyId,
      });
    }
    noteMoved(ledger, "teacherCourseAccess");
  }

  // ── read-along ──
  const sourceRecipes = await ctx.db
    .query("readAlongRecipes")
    .withIndex("by_family", (q) => q.eq("familyId", sourceFamilyId))
    .collect();
  for (const row of sourceRecipes) {
    if (!dryRun) {
      await ctx.db.patch("readAlongRecipes", row._id, {
        familyId: targetFamilyId,
      });
    }
    noteMoved(ledger, "readAlongRecipes");
  }

  const sourceStories = await ctx.db
    .query("readAlongStories")
    .withIndex("by_family", (q) => q.eq("familyId", sourceFamilyId))
    .collect();
  for (const row of sourceStories) {
    if (!dryRun) {
      await ctx.db.patch("readAlongStories", row._id, {
        familyId: targetFamilyId,
      });
    }
    noteMoved(ledger, "readAlongStories");
  }

  const sourceSessions = await ctx.db
    .query("readAlongSessions")
    .withIndex("by_family", (q) => q.eq("familyId", sourceFamilyId))
    .collect();
  for (const row of sourceSessions) {
    if (!dryRun) {
      await ctx.db.patch("readAlongSessions", row._id, {
        familyId: targetFamilyId,
      });
    }
    noteMoved(ledger, "readAlongSessions");
  }

  // ── contact links ──
  const sourceStudentLinks = await ctx.db
    .query("contactStudentLinks")
    .withIndex("by_family", (q) => q.eq("familyId", sourceFamilyId))
    .collect();
  for (const row of sourceStudentLinks) {
    if (!dryRun) {
      await ctx.db.patch("contactStudentLinks", row._id, {
        familyId: targetFamilyId,
      });
    }
    noteMoved(ledger, "contactStudentLinks");
  }

  const sourceCourseLinks = await ctx.db
    .query("contactCourseLinks")
    .withIndex("by_family", (q) => q.eq("familyId", sourceFamilyId))
    .collect();
  for (const row of sourceCourseLinks) {
    if (!dryRun) {
      await ctx.db.patch("contactCourseLinks", row._id, {
        familyId: targetFamilyId,
      });
    }
    noteMoved(ledger, "contactCourseLinks");
  }

  // ── contacts (repoint first, dedupe after students are collapsed) ──
  const sourceContacts = await ctx.db
    .query("contacts")
    .withIndex("by_family", (q) => q.eq("familyId", sourceFamilyId))
    .collect();
  for (const row of sourceContacts) {
    if (!dryRun) {
      await ctx.db.patch("contacts", row._id, {
        familyId: targetFamilyId,
        updatedAt: Date.now(),
      });
    }
    noteMoved(ledger, "contacts");
  }

  // ── students: repoint, then collapse same-child duplicates ──
  const targetStudents = await ctx.db
    .query("students")
    .withIndex("by_family", (q) => q.eq("familyId", targetFamilyId))
    .collect();
  const sourceStudents = await ctx.db
    .query("students")
    .withIndex("by_family", (q) => q.eq("familyId", sourceFamilyId))
    .collect();
  for (const student of sourceStudents) {
    if (!dryRun) {
      await ctx.db.patch("students", student._id, {
        familyId: targetFamilyId,
      });
    }
    noteMoved(ledger, "students");

    // gamificationAwards has no by_family index — it follows its student.
    const awards = await ctx.db
      .query("gamificationAwards")
      .withIndex("by_student", (q) => q.eq("studentId", student._id))
      .collect();
    for (const award of awards) {
      if (!dryRun) {
        await ctx.db.patch("gamificationAwards", award._id, {
          familyId: targetFamilyId,
        });
      }
      noteMoved(ledger, "gamificationAwards");
    }
  }

  const mergedStudents: Doc<"students">[] = [
    ...targetStudents,
    ...sourceStudents.map((s) => ({ ...s, familyId: targetFamilyId })),
  ];
  const studentsByName = new Map<string, Doc<"students">[]>();
  for (const student of mergedStudents) {
    const key = normalizeName(student.displayName);
    const bucket = studentsByName.get(key);
    if (bucket) bucket.push(student);
    else studentsByName.set(key, [student]);
  }

  const studentMerges: StudentMergeSummary[] = [];
  for (const rows of studentsByName.values()) {
    if (rows.length < 2) continue;
    const winner = pickStudentWinner(rows);
    for (const loser of rows) {
      if (loser._id === winner._id) continue;
      await mergeStudentRows(ctx, { winner, loser, ledger, dryRun });
      studentMerges.push({
        keptStudentId: winner._id,
        keptName: winner.displayName,
        removedStudentId: loser._id,
        removedName: loser.displayName,
      });
    }
  }

  // ── contacts: one card per person/school ──
  const contactMerges = await dedupeContactsForFamily(ctx, {
    familyId: targetFamilyId,
    extraContacts: dryRun ? sourceContacts : [],
    ledger,
    dryRun,
  });

  // ── the school row itself ──
  const hiddenSubjectIds = Array.from(
    new Set([
      ...(target.hiddenSubjectIds ?? []),
      ...(source.hiddenSubjectIds ?? []),
    ]),
  );

  if (!dryRun) {
    await ctx.db.patch("families", targetFamilyId, {
      name: survivingName,
      createdAt: Math.min(target.createdAt, source.createdAt),
      mainParentUserId: target.mainParentUserId ?? source.mainParentUserId,
      parentGuardrailContext:
        target.parentGuardrailContext ?? source.parentGuardrailContext,
      defaultPublicCheer:
        target.defaultPublicCheer ?? source.defaultPublicCheer,
      hiddenSubjectIds: hiddenSubjectIds.length > 0 ? hiddenSubjectIds : undefined,
    });
    const schoolCards = await ctx.db
      .query("contacts")
      .withIndex("by_family_and_kind", (q) =>
        q.eq("familyId", targetFamilyId).eq("kind", "school"),
      )
      .collect();
    for (const card of schoolCards) {
      await ctx.db.patch("contacts", card._id, {
        displayName: survivingName,
        updatedAt: Date.now(),
      });
    }
    await ctx.db.delete("families", sourceFamilyId);
  }
  noteDeleted(ledger, "families");

  const rows = ledgerToRows(ledger);
  const report: FamilyMergeReport = {
    dryRun,
    sourceFamilyId,
    sourceName: source.name,
    targetFamilyId,
    targetName: target.name,
    survivingName,
    moved: rows.moved,
    merged: rows.merged,
    deleted: rows.deleted,
    studentMerges,
    contactMerges,
    memberMerges,
    warnings: ledger.warnings,
  };

  console.log(
    `[merge] ${dryRun ? "DRY RUN " : ""}school "${source.name}" (${sourceFamilyId}) -> "${survivingName}" (${targetFamilyId}): ` +
      `moved ${rows.moved.reduce((n, r) => n + r.count, 0)}, ` +
      `merged ${rows.merged.reduce((n, r) => n + r.count, 0)}, ` +
      `deleted ${rows.deleted.reduce((n, r) => n + r.count, 0)}, ` +
      `students collapsed ${studentMerges.length}, contacts collapsed ${contactMerges.length}`,
  );

  return report;
}

export { dedupeContactsForFamily, pickStudentWinner };
