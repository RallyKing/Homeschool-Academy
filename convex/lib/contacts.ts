import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

type Ctx = QueryCtx | MutationCtx;

export type ContactKind =
  | "school"
  | "parent"
  | "teacher"
  | "tutor"
  | "student"
  | "user";

export async function findContactForEntity(
  ctx: Ctx,
  args: {
    kind: ContactKind;
    familyId?: Id<"families">;
    userId?: Id<"users">;
    studentId?: Id<"students">;
  },
): Promise<Doc<"contacts"> | null> {
  if (args.studentId) {
    const byStudent = await ctx.db
      .query("contacts")
      .withIndex("by_student", (q) => q.eq("studentId", args.studentId))
      .first();
    if (byStudent) return byStudent;
  }

  if (args.userId) {
    const byUser = await ctx.db
      .query("contacts")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    const match = byUser.find(
      (c) =>
        c.kind === args.kind &&
        (args.familyId === undefined || c.familyId === args.familyId),
    );
    if (match) return match;
  }

  if (args.kind === "school" && args.familyId) {
    return await ctx.db
      .query("contacts")
      .withIndex("by_family_and_kind", (q) =>
        q.eq("familyId", args.familyId).eq("kind", "school"),
      )
      .first();
  }

  return null;
}

export async function upsertEntityContact(
  ctx: MutationCtx,
  args: {
    kind: ContactKind;
    familyId?: Id<"families">;
    userId?: Id<"users">;
    studentId?: Id<"students">;
    academyId?: Id<"academies">;
    displayName: string;
    emails?: string[];
    phones?: string[];
    notes?: string;
    roleLabel?: string;
  },
): Promise<Id<"contacts">> {
  const displayName = args.displayName.trim();
  if (!displayName) {
    throw new Error("Contact name is required");
  }

  const emails = (args.emails ?? [])
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.includes("@"));
  const phones = (args.phones ?? []).map((p) => p.trim()).filter(Boolean);

  const existing = await findContactForEntity(ctx, {
    kind: args.kind,
    familyId: args.familyId,
    userId: args.userId,
    studentId: args.studentId,
  });

  const now = Date.now();
  if (existing) {
    await ctx.db.patch("contacts", existing._id, {
      displayName,
      emails,
      phones: phones.length > 0 ? phones : existing.phones,
      notes: args.notes !== undefined ? args.notes : existing.notes,
      roleLabel:
        args.roleLabel !== undefined ? args.roleLabel : existing.roleLabel,
      familyId: args.familyId ?? existing.familyId,
      userId: args.userId ?? existing.userId,
      studentId: args.studentId ?? existing.studentId,
      academyId: args.academyId ?? existing.academyId,
      updatedAt: now,
    });
    return existing._id;
  }

  return await ctx.db.insert("contacts", {
    kind: args.kind,
    familyId: args.familyId,
    userId: args.userId,
    studentId: args.studentId,
    academyId: args.academyId,
    displayName,
    emails,
    phones,
    notes: args.notes,
    roleLabel: args.roleLabel,
    createdAt: now,
  });
}

export async function deleteContactAndLinks(
  ctx: MutationCtx,
  contactId: Id<"contacts">,
): Promise<void> {
  const studentLinks = await ctx.db
    .query("contactStudentLinks")
    .withIndex("by_contact", (q) => q.eq("contactId", contactId))
    .collect();
  for (const link of studentLinks) {
    await ctx.db.delete("contactStudentLinks", link._id);
  }

  const courseLinks = await ctx.db
    .query("contactCourseLinks")
    .withIndex("by_contact", (q) => q.eq("contactId", contactId))
    .collect();
  for (const link of courseLinks) {
    await ctx.db.delete("contactCourseLinks", link._id);
  }

  await ctx.db.delete("contacts", contactId);
}

export async function deleteContactsForStudent(
  ctx: MutationCtx,
  studentId: Id<"students">,
): Promise<void> {
  const contacts = await ctx.db
    .query("contacts")
    .withIndex("by_student", (q) => q.eq("studentId", studentId))
    .collect();
  for (const contact of contacts) {
    await deleteContactAndLinks(ctx, contact._id);
  }

  const links = await ctx.db
    .query("contactStudentLinks")
    .withIndex("by_student", (q) => q.eq("studentId", studentId))
    .collect();
  for (const link of links) {
    await ctx.db.delete("contactStudentLinks", link._id);
  }
}

export async function deleteContactsForFamily(
  ctx: MutationCtx,
  familyId: Id<"families">,
): Promise<void> {
  const contacts = await ctx.db
    .query("contacts")
    .withIndex("by_family", (q) => q.eq("familyId", familyId))
    .collect();
  for (const contact of contacts) {
    await deleteContactAndLinks(ctx, contact._id);
  }
}

export async function deleteContactsForUser(
  ctx: MutationCtx,
  userId: Id<"users">,
): Promise<void> {
  const contacts = await ctx.db
    .query("contacts")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
  for (const contact of contacts) {
    await deleteContactAndLinks(ctx, contact._id);
  }
}

export async function replaceContactStudentLinks(
  ctx: MutationCtx,
  contactId: Id<"contacts">,
  familyId: Id<"families">,
  studentIds: Id<"students">[],
): Promise<void> {
  const existing = await ctx.db
    .query("contactStudentLinks")
    .withIndex("by_contact", (q) => q.eq("contactId", contactId))
    .collect();
  for (const link of existing) {
    await ctx.db.delete("contactStudentLinks", link._id);
  }
  const seen = new Set<string>();
  for (const studentId of studentIds) {
    if (seen.has(studentId)) continue;
    seen.add(studentId);
    await ctx.db.insert("contactStudentLinks", {
      contactId,
      studentId,
      familyId,
      createdAt: Date.now(),
    });
  }
}

export async function replaceContactCourseLinks(
  ctx: MutationCtx,
  contactId: Id<"contacts">,
  familyId: Id<"families">,
  courseIds: Id<"courses">[],
): Promise<void> {
  const existing = await ctx.db
    .query("contactCourseLinks")
    .withIndex("by_contact", (q) => q.eq("contactId", contactId))
    .collect();
  for (const link of existing) {
    await ctx.db.delete("contactCourseLinks", link._id);
  }
  const seen = new Set<string>();
  for (const courseId of courseIds) {
    if (seen.has(courseId)) continue;
    seen.add(courseId);
    await ctx.db.insert("contactCourseLinks", {
      contactId,
      courseId,
      familyId,
      createdAt: Date.now(),
    });
  }
}
