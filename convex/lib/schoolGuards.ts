import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { normalizeName } from "./mergeCore";

type Ctx = QueryCtx | MutationCtx;

/**
 * Guards that stop duplicate schools/students from being created in the first
 * place. Names are compared case-insensitively with collapsed whitespace, so
 * "Ballard Family" and "ballard  family" collide.
 */

export async function findFamilyByName(
  ctx: Ctx,
  name: string,
  exceptFamilyId?: Id<"families">,
): Promise<Doc<"families"> | null> {
  const key = normalizeName(name);
  if (!key) return null;
  const families = await ctx.db.query("families").take(200);
  return (
    families.find(
      (family) =>
        family._id !== exceptFamilyId && normalizeName(family.name) === key,
    ) ?? null
  );
}

export async function assertSchoolNameAvailable(
  ctx: Ctx,
  args: {
    name: string;
    allowDuplicateName?: boolean;
    exceptFamilyId?: Id<"families">;
  },
): Promise<void> {
  if (args.allowDuplicateName) return;
  const existing = await findFamilyByName(ctx, args.name, args.exceptFamilyId);
  if (!existing) return;
  throw new Error(
    `A school named "${existing.name}" already exists. Attach this parent to it instead, or confirm "Create anyway" to keep both.`,
  );
}

export async function findStudentByName(
  ctx: Ctx,
  familyId: Id<"families">,
  displayName: string,
  exceptStudentId?: Id<"students">,
): Promise<Doc<"students"> | null> {
  const key = normalizeName(displayName);
  if (!key) return null;
  const students = await ctx.db
    .query("students")
    .withIndex("by_family", (q) => q.eq("familyId", familyId))
    .collect();
  return (
    students.find(
      (student) =>
        student._id !== exceptStudentId &&
        normalizeName(student.displayName) === key,
    ) ?? null
  );
}

export async function assertStudentNameAvailable(
  ctx: Ctx,
  args: {
    familyId: Id<"families">;
    displayName: string;
    allowDuplicateName?: boolean;
    exceptStudentId?: Id<"students">;
  },
): Promise<void> {
  if (args.allowDuplicateName) return;
  const existing = await findStudentByName(
    ctx,
    args.familyId,
    args.displayName,
    args.exceptStudentId,
  );
  if (!existing) return;
  throw new Error(
    `"${existing.displayName}" is already a student at this school. Edit that profile instead, or confirm "Add anyway" if these are different children.`,
  );
}
