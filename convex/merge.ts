import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, mutation, query } from "./_generated/server";
import { requireSuperAdmin } from "./lib/auth";
import {
  dedupeContactsForFamily,
  ledgerToRows,
  mergeContactRows,
  mergeFamiliesCore,
  mergeStudentRows,
  newLedger,
  normalizeName,
} from "./lib/mergeCore";
import { contactDocValidator, familyDocValidator } from "./lib/validators";

/**
 * SuperAdmin de-duplication tooling. These are ongoing maintenance operations
 * on existing entities rather than a new entity, so they add no table and no
 * separate CRUD surface — the underlying schools/students/contacts keep their
 * own full CRUD in families.ts / students.ts / contacts.ts.
 */

const countRowsValidator = v.array(
  v.object({ table: v.string(), count: v.number() }),
);

const mergeCountsValidator = v.object({
  dryRun: v.boolean(),
  moved: countRowsValidator,
  merged: countRowsValidator,
  deleted: countRowsValidator,
  warnings: v.array(v.string()),
});

const familyMergeReportValidator = v.object({
  dryRun: v.boolean(),
  sourceFamilyId: v.id("families"),
  sourceName: v.string(),
  targetFamilyId: v.id("families"),
  targetName: v.string(),
  survivingName: v.string(),
  moved: countRowsValidator,
  merged: countRowsValidator,
  deleted: countRowsValidator,
  studentMerges: v.array(
    v.object({
      keptStudentId: v.id("students"),
      keptName: v.string(),
      removedStudentId: v.id("students"),
      removedName: v.string(),
    }),
  ),
  contactMerges: v.array(
    v.object({
      keptContactId: v.id("contacts"),
      removedContactId: v.id("contacts"),
      displayName: v.string(),
    }),
  ),
  memberMerges: v.array(
    v.object({
      userId: v.id("users"),
      schoolRole: v.union(
        v.literal("main"),
        v.literal("admin"),
        v.literal("regular"),
      ),
    }),
  ),
  warnings: v.array(v.string()),
});

const keepNameValidator = v.union(
  v.literal("target"),
  v.literal("source"),
  v.literal("custom"),
);

const GENERIC_SCHOOL_TOKENS = new Set([
  "family",
  "families",
  "school",
  "academy",
  "kids",
  "kid",
  "learning",
  "homeschool",
  "household",
]);

function distinctiveTokens(name: string): string[] {
  const seen = new Set<string>();
  const tokens: string[] = [];
  for (const token of normalizeName(name).split(" ")) {
    if (token.length < 5 || GENERIC_SCHOOL_TOKENS.has(token) || seen.has(token)) {
      continue;
    }
    seen.add(token);
    tokens.push(token);
  }
  return tokens;
}

function similarSchoolGroups(
  families: Doc<"families">[],
  exactNameDupes: Array<{ normalizedName: string }>,
): Array<{ token: string; families: Doc<"families">[] }> {
  const exactNames = new Set(exactNameDupes.map((g) => g.normalizedName));
  const tokenGroups = new Map<string, Doc<"families">[]>();
  for (const family of families) {
    if (exactNames.has(normalizeName(family.name))) continue;
    for (const token of distinctiveTokens(family.name)) {
      const bucket = tokenGroups.get(token);
      if (bucket) bucket.push(family);
      else tokenGroups.set(token, [family]);
    }
  }

  const groups: Array<{ token: string; families: Doc<"families">[] }> = [];
  for (const [token, group] of tokenGroups) {
    const uniqueIds = new Set(group.map((f) => f._id as string));
    if (uniqueIds.size < 2) continue;
    const uniqueNames = new Set(group.map((f) => normalizeName(f.name)));
    if (uniqueNames.size < 2) continue;
    const deduped: Doc<"families">[] = [];
    const seen = new Set<string>();
    for (const family of group) {
      if (seen.has(family._id)) continue;
      seen.add(family._id);
      deduped.push(family);
    }
    groups.push({ token, families: deduped });
  }
  return groups;
}

/** Schools with enough context for an admin to pick the surviving record. */
export const listSchools = query({
  args: {},
  returns: v.array(
    v.object({
      family: familyDocValidator,
      studentCount: v.number(),
      parentCount: v.number(),
      courseCount: v.number(),
      logCount: v.number(),
      contactCount: v.number(),
      duplicateNameWith: v.array(v.id("families")),
    }),
  ),
  handler: async (ctx) => {
    await requireSuperAdmin(ctx);
    const families = await ctx.db.query("families").take(200);

    const byName = new Map<string, Id<"families">[]>();
    for (const family of families) {
      const key = normalizeName(family.name);
      const bucket = byName.get(key);
      if (bucket) bucket.push(family._id);
      else byName.set(key, [family._id]);
    }

    const rows = [];
    for (const family of families) {
      const students = await ctx.db
        .query("students")
        .withIndex("by_family", (q) => q.eq("familyId", family._id))
        .collect();
      const parents = await ctx.db
        .query("familyMembers")
        .withIndex("by_family", (q) => q.eq("familyId", family._id))
        .collect();
      const courses = await ctx.db
        .query("courses")
        .withIndex("by_family", (q) => q.eq("familyId", family._id))
        .collect();
      const contacts = await ctx.db
        .query("contacts")
        .withIndex("by_family", (q) => q.eq("familyId", family._id))
        .collect();

      let logCount = 0;
      for (const student of students) {
        const logs = await ctx.db
          .query("logs")
          .withIndex("by_student", (q) => q.eq("studentId", student._id))
          .collect();
        logCount += logs.length;
      }

      rows.push({
        family,
        studentCount: students.length,
        parentCount: parents.length,
        courseCount: courses.length,
        logCount,
        contactCount: contacts.length,
        duplicateNameWith: (byName.get(normalizeName(family.name)) ?? []).filter(
          (id) => id !== family._id,
        ),
      });
    }

    return rows.sort((a, b) => a.family.name.localeCompare(b.family.name));
  },
});

/** Everything that currently looks duplicated across the platform. */
export const duplicates = query({
  args: {},
  returns: v.object({
    schools: v.array(
      v.object({
        normalizedName: v.string(),
        families: v.array(
          v.object({
            _id: v.id("families"),
            name: v.string(),
            createdAt: v.number(),
            studentCount: v.number(),
          }),
        ),
      }),
    ),
    students: v.array(
      v.object({
        familyId: v.id("families"),
        familyName: v.string(),
        displayName: v.string(),
        studentIds: v.array(v.id("students")),
      }),
    ),
    contacts: v.array(
      v.object({
        label: v.string(),
        familyId: v.optional(v.id("families")),
        familyName: v.optional(v.string()),
        contacts: v.array(contactDocValidator),
      }),
    ),
    similarSchools: v.array(
      v.object({
        token: v.string(),
        families: v.array(
          v.object({
            _id: v.id("families"),
            name: v.string(),
            createdAt: v.number(),
            studentCount: v.number(),
          }),
        ),
      }),
    ),
  }),
  handler: async (ctx) => {
    await requireSuperAdmin(ctx);

    const families = await ctx.db.query("families").take(200);
    const familyName = new Map(families.map((f) => [f._id as string, f.name]));

    const schoolGroups = new Map<string, typeof families>();
    for (const family of families) {
      const key = normalizeName(family.name);
      const bucket = schoolGroups.get(key);
      if (bucket) bucket.push(family);
      else schoolGroups.set(key, [family]);
    }

    const schools = [];
    for (const [normalizedName, group] of schoolGroups) {
      if (group.length < 2) continue;
      const entries = [];
      for (const family of group) {
        const students = await ctx.db
          .query("students")
          .withIndex("by_family", (q) => q.eq("familyId", family._id))
          .collect();
        entries.push({
          _id: family._id,
          name: family.name,
          createdAt: family.createdAt,
          studentCount: students.length,
        });
      }
      schools.push({ normalizedName, families: entries });
    }

    const students = [];
    for (const family of families) {
      const rows = await ctx.db
        .query("students")
        .withIndex("by_family", (q) => q.eq("familyId", family._id))
        .collect();
      const byName = new Map<string, Doc<"students">[]>();
      for (const row of rows) {
        const key = normalizeName(row.displayName);
        const bucket = byName.get(key);
        if (bucket) bucket.push(row);
        else byName.set(key, [row]);
      }
      for (const bucket of byName.values()) {
        if (bucket.length < 2) continue;
        students.push({
          familyId: family._id,
          familyName: family.name,
          displayName: bucket[0]!.displayName,
          studentIds: bucket.map((s) => s._id),
        });
      }
    }

    const allContacts = await ctx.db.query("contacts").take(500);
    const contactGroups = new Map<string, Doc<"contacts">[]>();
    for (const contact of allContacts) {
      let key: string;
      if (contact.studentId) key = `student:${contact.studentId}`;
      else if (contact.userId) {
        // A person may legitimately appear once per school they belong to.
        key = `user:${contact.userId}`;
      } else if (contact.kind === "school" && contact.familyId) {
        key = `school:${contact.familyId}`;
      } else {
        key = `name:${contact.familyId ?? "none"}:${contact.kind}:${normalizeName(contact.displayName)}`;
      }
      const bucket = contactGroups.get(key);
      if (bucket) bucket.push(contact);
      else contactGroups.set(key, [contact]);
    }

    const contacts = [];
    for (const bucket of contactGroups.values()) {
      if (bucket.length < 2) continue;
      // Same person at two different schools is not a duplicate.
      const familyIds = new Set(
        bucket.map((c) => (c.familyId ? (c.familyId as string) : "none")),
      );
      const scopedFamilies = new Set(
        [...familyIds].filter((id) => id !== "none"),
      );
      if (scopedFamilies.size > 1) continue;

      const familyId = bucket.find((c) => c.familyId)?.familyId;
      contacts.push({
        label: bucket[0]!.displayName,
        familyId,
        familyName: familyId ? familyName.get(familyId) : undefined,
        contacts: bucket,
      });
    }

    const similarSchools = similarSchoolGroups(families, schools);
    const similarWithCounts = [];
    for (const group of similarSchools) {
      const entries = [];
      for (const family of group.families) {
        const studentRows = await ctx.db
          .query("students")
          .withIndex("by_family", (q) => q.eq("familyId", family._id))
          .collect();
        entries.push({
          _id: family._id,
          name: family.name,
          createdAt: family.createdAt,
          studentCount: studentRows.length,
        });
      }
      similarWithCounts.push({ token: group.token, families: entries });
    }

    return { schools, students, contacts, similarSchools: similarWithCounts };
  },
});

const familyMergeArgs = {
  sourceFamilyId: v.id("families"),
  targetFamilyId: v.id("families"),
  keepName: v.optional(keepNameValidator),
  customName: v.optional(v.string()),
  dryRun: v.boolean(),
};

async function runFamilyMerge(
  ctx: Parameters<typeof mergeFamiliesCore>[0],
  args: {
    sourceFamilyId: Id<"families">;
    targetFamilyId: Id<"families">;
    keepName?: "target" | "source" | "custom";
    customName?: string;
    dryRun: boolean;
  },
) {
  return await mergeFamiliesCore(ctx, {
    sourceFamilyId: args.sourceFamilyId,
    targetFamilyId: args.targetFamilyId,
    keepName: args.keepName ?? "target",
    customName: args.customName,
    dryRun: args.dryRun,
  });
}

export const mergeFamilies = mutation({
  args: familyMergeArgs,
  returns: familyMergeReportValidator,
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);
    return await runFamilyMerge(ctx, args);
  },
});

/** Dashboard/CLI entry point — no end-user auth, production maintenance only. */
export const applyFamilyMerge = internalMutation({
  args: familyMergeArgs,
  returns: familyMergeReportValidator,
  handler: async (ctx, args) => {
    return await runFamilyMerge(ctx, args);
  },
});

export const mergeStudents = mutation({
  args: {
    sourceStudentId: v.id("students"),
    targetStudentId: v.id("students"),
    dryRun: v.boolean(),
  },
  returns: mergeCountsValidator,
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);
    if (args.sourceStudentId === args.targetStudentId) {
      throw new Error("Cannot merge a student into itself");
    }

    const loser = await ctx.db.get("students", args.sourceStudentId);
    if (!loser) throw new Error("Source student not found");
    const winner = await ctx.db.get("students", args.targetStudentId);
    if (!winner) throw new Error("Target student not found");

    const ledger = newLedger();
    await mergeStudentRows(ctx, {
      winner,
      loser,
      ledger,
      dryRun: args.dryRun,
    });

    const rows = ledgerToRows(ledger);
    console.log(
      `[merge] ${args.dryRun ? "DRY RUN " : ""}student "${loser.displayName}" (${loser._id}) -> "${winner.displayName}" (${winner._id})`,
    );
    return { dryRun: args.dryRun, ...rows, warnings: ledger.warnings };
  },
});

export const mergeContacts = mutation({
  args: {
    sourceContactId: v.id("contacts"),
    targetContactId: v.id("contacts"),
    dryRun: v.boolean(),
  },
  returns: mergeCountsValidator,
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);
    if (args.sourceContactId === args.targetContactId) {
      throw new Error("Cannot merge a contact into itself");
    }

    const loser = await ctx.db.get("contacts", args.sourceContactId);
    if (!loser) throw new Error("Source contact not found");
    const winner = await ctx.db.get("contacts", args.targetContactId);
    if (!winner) throw new Error("Target contact not found");

    if (
      loser.familyId &&
      winner.familyId &&
      loser.familyId !== winner.familyId
    ) {
      throw new Error(
        "These contacts belong to different schools. Merge the schools first.",
      );
    }

    const ledger = newLedger();
    await mergeContactRows(ctx, {
      winner,
      loser,
      ledger,
      dryRun: args.dryRun,
    });

    const rows = ledgerToRows(ledger);
    console.log(
      `[merge] ${args.dryRun ? "DRY RUN " : ""}contact "${loser.displayName}" (${loser._id}) -> "${winner.displayName}" (${winner._id})`,
    );
    return { dryRun: args.dryRun, ...rows, warnings: ledger.warnings };
  },
});

/** Collapse every duplicate contact card inside one school. */
export const dedupeSchoolContacts = mutation({
  args: {
    familyId: v.id("families"),
    dryRun: v.boolean(),
  },
  returns: v.object({
    dryRun: v.boolean(),
    moved: countRowsValidator,
    merged: countRowsValidator,
    deleted: countRowsValidator,
    contactMerges: v.array(
      v.object({
        keptContactId: v.id("contacts"),
        removedContactId: v.id("contacts"),
        displayName: v.string(),
      }),
    ),
    warnings: v.array(v.string()),
  }),
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);
    const family = await ctx.db.get("families", args.familyId);
    if (!family) throw new Error("School not found");

    const ledger = newLedger();
    const contactMerges = await dedupeContactsForFamily(ctx, {
      familyId: args.familyId,
      extraContacts: [],
      ledger,
      dryRun: args.dryRun,
    });

    const rows = ledgerToRows(ledger);
    console.log(
      `[merge] ${args.dryRun ? "DRY RUN " : ""}deduped ${contactMerges.length} contact card(s) in "${family.name}" (${args.familyId})`,
    );
    return {
      dryRun: args.dryRun,
      ...rows,
      contactMerges,
      warnings: ledger.warnings,
    };
  },
});
