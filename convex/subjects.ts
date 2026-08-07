import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import {
  getCurrentUser,
  getPrimaryFamilyForUser,
  requireFamilyAccess,
  requireRole,
} from "./lib/auth";
import { subjectCategoryValidator, subjectDocValidator } from "./lib/validators";

const SEED_SUBJECTS: Array<{
  name: string;
  category: "stem" | "humanities" | "life" | "applied";
}> = [
  { name: "Math", category: "stem" },
  { name: "Science", category: "stem" },
  { name: "AI/CS", category: "stem" },
  { name: "Reading", category: "humanities" },
  { name: "Art", category: "humanities" },
  { name: "Music", category: "humanities" },
  { name: "Executive Function/Ethics", category: "life" },
  { name: "Law/History", category: "life" },
  { name: "PE", category: "applied" },
  { name: "Entrepreneurship", category: "applied" },
];

type Ctx = QueryCtx | MutationCtx;

async function listGlobalSubjects(ctx: Ctx): Promise<Doc<"subjects">[]> {
  const all = await ctx.db.query("subjects").collect();
  return all.filter((s) => s.familyId === undefined);
}

async function listFamilyCustomSubjects(
  ctx: Ctx,
  familyId: Id<"families">,
): Promise<Doc<"subjects">[]> {
  return await ctx.db
    .query("subjects")
    .withIndex("by_family", (q) => q.eq("familyId", familyId))
    .collect();
}

async function findNameConflict(
  ctx: Ctx,
  name: string,
  familyId: Id<"families"> | undefined,
  excludeId?: Id<"subjects">,
): Promise<boolean> {
  if (familyId) {
    const customs = await listFamilyCustomSubjects(ctx, familyId);
    return customs.some(
      (s) =>
        s.name.toLowerCase() === name.toLowerCase() && s._id !== excludeId,
    );
  }
  const globals = await listGlobalSubjects(ctx);
  return globals.some(
    (s) => s.name.toLowerCase() === name.toLowerCase() && s._id !== excludeId,
  );
}

/** Global platform subjects + caller's family custom subjects (hidden filtered). */
export const list = query({
  args: {},
  returns: v.array(subjectDocValidator),
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    const family = await getPrimaryFamilyForUser(ctx, user._id);
    const globals = await listGlobalSubjects(ctx);
    if (!family) {
      return globals;
    }
    const hidden = new Set(family.hiddenSubjectIds ?? []);
    const customs = await listFamilyCustomSubjects(ctx, family._id);
    return [
      ...globals.filter((s) => !hidden.has(s._id)),
      ...customs,
    ].sort((a, b) => a.name.localeCompare(b.name));
  },
});

/** Settings view: globals (with hidden flag) + family customs. */
export const listForSettings = query({
  args: { familyId: v.id("families") },
  returns: v.array(
    v.object({
      subject: subjectDocValidator,
      isCustom: v.boolean(),
      isHidden: v.boolean(),
      canEdit: v.boolean(),
      canDelete: v.boolean(),
    }),
  ),
  handler: async (ctx, args) => {
    await requireFamilyAccess(ctx, args.familyId);
    const family = await ctx.db.get("families", args.familyId);
    if (!family) throw new Error("Family not found");

    const hidden = new Set(family.hiddenSubjectIds ?? []);
    const globals = await listGlobalSubjects(ctx);
    const customs = await listFamilyCustomSubjects(ctx, args.familyId);

    const rows = [
      ...globals.map((subject) => ({
        subject,
        isCustom: false,
        isHidden: hidden.has(subject._id),
        canEdit: false,
        canDelete: false,
      })),
      ...customs.map((subject) => ({
        subject,
        isCustom: true,
        isHidden: false,
        canEdit: true,
        canDelete: true,
      })),
    ];

    return rows.sort((a, b) =>
      a.subject.name.localeCompare(b.subject.name),
    );
  },
});

export const listByCategory = query({
  args: { category: subjectCategoryValidator },
  returns: v.array(subjectDocValidator),
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    const family = await getPrimaryFamilyForUser(ctx, user._id);
    const globals = await listGlobalSubjects(ctx);
    let subjects = globals;
    if (family) {
      const hidden = new Set(family.hiddenSubjectIds ?? []);
      const customs = await listFamilyCustomSubjects(ctx, family._id);
      subjects = [
        ...globals.filter((s) => !hidden.has(s._id)),
        ...customs,
      ];
    }
    return subjects.filter((s) => s.category === args.category);
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    category: subjectCategoryValidator,
    familyId: v.optional(v.id("families")),
  },
  returns: v.id("subjects"),
  handler: async (ctx, args) => {
    const user = await requireRole(ctx, ["superAdmin", "parent"]);
    const name = args.name.trim();
    if (!name) throw new Error("Subject name is required");

    let familyId = args.familyId;
    if (user.role === "superAdmin" && !familyId) {
      // Platform subject
      if (await findNameConflict(ctx, name, undefined)) {
        throw new Error("A subject with that name already exists");
      }
      return await ctx.db.insert("subjects", {
        name,
        category: args.category,
        createdAt: Date.now(),
      });
    }

    if (!familyId) {
      const family = await getPrimaryFamilyForUser(ctx, user._id);
      if (!family) throw new Error("No family found");
      familyId = family._id;
    }
    await requireFamilyAccess(ctx, familyId);

    if (await findNameConflict(ctx, name, familyId)) {
      throw new Error("Your family already has a subject with that name");
    }

    return await ctx.db.insert("subjects", {
      name,
      category: args.category,
      familyId,
      createdAt: Date.now(),
    });
  },
});

export const update = mutation({
  args: {
    subjectId: v.id("subjects"),
    name: v.optional(v.string()),
    category: v.optional(subjectCategoryValidator),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireRole(ctx, ["superAdmin", "parent"]);
    const subject = await ctx.db.get("subjects", args.subjectId);
    if (!subject) throw new Error("Subject not found");

    const isGlobal = subject.familyId === undefined;
    if (isGlobal) {
      if (user.role !== "superAdmin") {
        throw new Error("Only admins can edit platform subjects");
      }
    } else {
      if (!subject.familyId) {
        throw new Error("Subject family is missing");
      }
      await requireFamilyAccess(ctx, subject.familyId);
    }

    const patch: {
      name?: string;
      category?: typeof args.category;
    } = {};

    if (args.name !== undefined) {
      const name = args.name.trim();
      if (!name) throw new Error("Subject name is required");
      if (await findNameConflict(ctx, name, subject.familyId, args.subjectId)) {
        throw new Error("A subject with that name already exists");
      }
      patch.name = name;
    }
    if (args.category !== undefined) {
      patch.category = args.category;
    }

    await ctx.db.patch("subjects", args.subjectId, patch);
    return null;
  },
});

export const remove = mutation({
  args: { subjectId: v.id("subjects") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireRole(ctx, ["superAdmin", "parent"]);
    const subject = await ctx.db.get("subjects", args.subjectId);
    if (!subject) throw new Error("Subject not found");

    const isGlobal = subject.familyId === undefined;
    if (isGlobal) {
      if (user.role !== "superAdmin") {
        throw new Error(
          "Platform subjects cannot be deleted — hide them from your family instead",
        );
      }
    } else {
      if (!subject.familyId) {
        throw new Error("Subject family is missing");
      }
      await requireFamilyAccess(ctx, subject.familyId);
    }

    const inUse = await ctx.db
      .query("courses")
      .withIndex("by_subject", (q) => q.eq("subjectId", args.subjectId))
      .first();
    if (inUse) {
      throw new Error("Cannot delete subject while courses still reference it");
    }

    await ctx.db.delete("subjects", args.subjectId);
    return null;
  },
});

/** Soft-hide (or unhide) a platform subject for one family. */
export const setHiddenForFamily = mutation({
  args: {
    familyId: v.id("families"),
    subjectId: v.id("subjects"),
    hidden: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireFamilyAccess(ctx, args.familyId);
    const subject = await ctx.db.get("subjects", args.subjectId);
    if (!subject) throw new Error("Subject not found");
    if (subject.familyId !== undefined) {
      throw new Error("Hide only applies to platform subjects — delete customs instead");
    }

    const family = await ctx.db.get("families", args.familyId);
    if (!family) throw new Error("Family not found");

    const current = new Set(family.hiddenSubjectIds ?? []);
    if (args.hidden) {
      current.add(args.subjectId);
    } else {
      current.delete(args.subjectId);
    }

    await ctx.db.patch("families", args.familyId, {
      hiddenSubjectIds: [...current],
    });
    return null;
  },
});

/** Clone a platform subject into a family-owned editable copy. */
export const cloneForFamily = mutation({
  args: {
    familyId: v.id("families"),
    subjectId: v.id("subjects"),
    name: v.optional(v.string()),
  },
  returns: v.id("subjects"),
  handler: async (ctx, args) => {
    await requireFamilyAccess(ctx, args.familyId);
    const subject = await ctx.db.get("subjects", args.subjectId);
    if (!subject) throw new Error("Subject not found");
    if (subject.familyId !== undefined) {
      throw new Error("Only platform subjects can be cloned");
    }

    const name = (args.name?.trim() || `${subject.name} (custom)`).trim();
    if (await findNameConflict(ctx, name, args.familyId)) {
      throw new Error("Your family already has a subject with that name");
    }

    return await ctx.db.insert("subjects", {
      name,
      category: subject.category,
      familyId: args.familyId,
      createdAt: Date.now(),
    });
  },
});

export const seed = mutation({
  args: {},
  returns: v.object({
    created: v.number(),
    total: v.number(),
  }),
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    const existingGlobals = await listGlobalSubjects(ctx);
    if (existingGlobals.length > 0 && user.role !== "superAdmin") {
      throw new Error("Subjects already seeded. SuperAdmin required to re-run.");
    }

    const now = Date.now();
    let created = 0;

    for (const subject of SEED_SUBJECTS) {
      const exists = existingGlobals.some(
        (s) => s.name.toLowerCase() === subject.name.toLowerCase(),
      );
      if (!exists) {
        await ctx.db.insert("subjects", {
          name: subject.name,
          category: subject.category,
          createdAt: now,
        });
        created += 1;
      }
    }

    return { created, total: SEED_SUBJECTS.length };
  },
});

export const seedInternal = internalMutation({
  args: {},
  returns: v.object({
    created: v.number(),
    total: v.number(),
  }),
  handler: async (ctx) => {
    const now = Date.now();
    let created = 0;
    const existingGlobals = await listGlobalSubjects(ctx);

    for (const subject of SEED_SUBJECTS) {
      const exists = existingGlobals.some(
        (s) => s.name.toLowerCase() === subject.name.toLowerCase(),
      );
      if (!exists) {
        await ctx.db.insert("subjects", {
          name: subject.name,
          category: subject.category,
          createdAt: now,
        });
        created += 1;
      }
    }

    return { created, total: SEED_SUBJECTS.length };
  },
});
