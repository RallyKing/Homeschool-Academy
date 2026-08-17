import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import {
  getCurrentUser,
  getFamilyMembership,
  getSchoolStaff,
  listAssignedStudentIds,
  requireSchoolAdmin,
  teacherHasStudentAccess,
} from "./lib/auth";
import {
  deleteContactAndLinks,
  replaceContactCourseLinks,
  replaceContactStudentLinks,
} from "./lib/contacts";
import {
  contactDocValidator,
  contactKindValidator,
} from "./lib/validators";

const contactDetailValidator = v.object({
  contact: contactDocValidator,
  students: v.array(
    v.object({
      _id: v.id("students"),
      displayName: v.string(),
    }),
  ),
  courses: v.array(
    v.object({
      _id: v.id("courses"),
      title: v.string(),
    }),
  ),
  schoolName: v.optional(v.string()),
});

async function canViewContact(
  ctx: Parameters<typeof getCurrentUser>[0],
  contactId: Id<"contacts">,
) {
  const user = await getCurrentUser(ctx);
  const contact = await ctx.db.get("contacts", contactId);
  if (!contact) return { user, contact: null, allowed: false as const };

  if (user.role === "superAdmin") {
    return { user, contact, allowed: true as const };
  }

  if (contact.userId === user._id) {
    return { user, contact, allowed: true as const };
  }

  if (contact.studentId) {
    const student = await ctx.db.get("students", contact.studentId);
    if (student?.userId === user._id) {
      return { user, contact, allowed: true as const };
    }
    if (await teacherHasStudentAccess(ctx, user._id, contact.studentId)) {
      return { user, contact, allowed: true as const };
    }
    if (student) {
      const membership = await getFamilyMembership(
        ctx,
        student.familyId,
        user._id,
      );
      if (membership) return { user, contact, allowed: true as const };
    }
  }

  if (contact.familyId) {
    const membership = await getFamilyMembership(
      ctx,
      contact.familyId,
      user._id,
    );
    if (membership) return { user, contact, allowed: true as const };
    const staff = await getSchoolStaff(ctx, contact.familyId, user._id);
    if (staff) {
      if (contact.kind === "student" && contact.studentId) {
        const allowed = await teacherHasStudentAccess(
          ctx,
          user._id,
          contact.studentId,
        );
        return { user, contact, allowed };
      }
      if (contact.kind === "school") {
        return { user, contact, allowed: true as const };
      }
      if (contact.userId === user._id) {
        return { user, contact, allowed: true as const };
      }
      return { user, contact, allowed: false as const };
    }
  }

  return { user, contact, allowed: false as const };
}

export const list = query({
  args: {
    familyId: v.optional(v.id("families")),
    kind: v.optional(contactKindValidator),
  },
  returns: v.array(contactDocValidator),
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);

    if (user.role === "superAdmin") {
      if (args.familyId) {
        const rows = await ctx.db
          .query("contacts")
          .withIndex("by_family", (q) => q.eq("familyId", args.familyId))
          .take(200);
        return args.kind ? rows.filter((c) => c.kind === args.kind) : rows;
      }
      const rows = await ctx.db.query("contacts").take(200);
      return args.kind ? rows.filter((c) => c.kind === args.kind) : rows;
    }

    if (args.familyId) {
      const membership = await getFamilyMembership(ctx, args.familyId, user._id);
      const staff = await getSchoolStaff(ctx, args.familyId, user._id);
      if (!membership && !staff) {
        throw new Error("Unauthorized: no access to this school's contacts");
      }

      const rows = await ctx.db
        .query("contacts")
        .withIndex("by_family", (q) => q.eq("familyId", args.familyId))
        .take(200);

      if (membership) {
        return args.kind ? rows.filter((c) => c.kind === args.kind) : rows;
      }

      const assigned = new Set(
        (await listAssignedStudentIds(ctx, user._id, args.familyId)).map(
          (id) => id as string,
        ),
      );
      return rows.filter((c) => {
        if (args.kind && c.kind !== args.kind) return false;
        if (c.kind === "school") return true;
        if (c.userId === user._id) return true;
        if (c.kind === "student" && c.studentId && assigned.has(c.studentId)) {
          return true;
        }
        return false;
      });
    }

    const mine = await ctx.db
      .query("contacts")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .take(50);

    const memberships = await ctx.db
      .query("familyMembers")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    const collected = [...mine];
    const seen = new Set(mine.map((c) => c._id as string));

    for (const membership of memberships) {
      const rows = await ctx.db
        .query("contacts")
        .withIndex("by_family", (q) => q.eq("familyId", membership.familyId))
        .take(200);
      for (const row of rows) {
        if (seen.has(row._id)) continue;
        seen.add(row._id);
        collected.push(row);
      }
    }

    const staffRows = await ctx.db
      .query("schoolStaff")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    for (const staff of staffRows) {
      if (memberships.some((m) => m.familyId === staff.familyId)) continue;
      const assigned = new Set(
        (await listAssignedStudentIds(ctx, user._id, staff.familyId)).map(
          (id) => id as string,
        ),
      );
      const rows = await ctx.db
        .query("contacts")
        .withIndex("by_family", (q) => q.eq("familyId", staff.familyId))
        .take(200);
      for (const row of rows) {
        if (seen.has(row._id)) continue;
        const visible =
          row.kind === "school" ||
          row.userId === user._id ||
          (row.kind === "student" &&
            row.studentId &&
            assigned.has(row.studentId));
        if (!visible) continue;
        seen.add(row._id);
        collected.push(row);
      }
    }

    return args.kind
      ? collected.filter((c) => c.kind === args.kind)
      : collected;
  },
});

export const get = query({
  args: { contactId: v.id("contacts") },
  returns: v.union(contactDetailValidator, v.null()),
  handler: async (ctx, args) => {
    const { contact, allowed } = await canViewContact(ctx, args.contactId);
    if (!contact || !allowed) return null;

    const studentLinks = await ctx.db
      .query("contactStudentLinks")
      .withIndex("by_contact", (q) => q.eq("contactId", args.contactId))
      .collect();
    const students = [];
    for (const link of studentLinks) {
      const student = await ctx.db.get("students", link.studentId);
      if (student) {
        students.push({ _id: student._id, displayName: student.displayName });
      }
    }
    if (contact.studentId && !students.some((s) => s._id === contact.studentId)) {
      const student = await ctx.db.get("students", contact.studentId);
      if (student) {
        students.push({ _id: student._id, displayName: student.displayName });
      }
    }

    const courseLinks = await ctx.db
      .query("contactCourseLinks")
      .withIndex("by_contact", (q) => q.eq("contactId", args.contactId))
      .collect();
    const courses = [];
    for (const link of courseLinks) {
      const course = await ctx.db.get("courses", link.courseId);
      if (course) {
        courses.push({ _id: course._id, title: course.title });
      }
    }

    let schoolName: string | undefined;
    if (contact.familyId) {
      const family = await ctx.db.get("families", contact.familyId);
      schoolName = family?.name;
    }

    return { contact, students, courses, schoolName };
  },
});

export const create = mutation({
  args: {
    familyId: v.id("families"),
    kind: contactKindValidator,
    displayName: v.string(),
    emails: v.optional(v.array(v.string())),
    phones: v.optional(v.array(v.string())),
    notes: v.optional(v.string()),
    roleLabel: v.optional(v.string()),
    userId: v.optional(v.id("users")),
    studentId: v.optional(v.id("students")),
    studentIds: v.optional(v.array(v.id("students"))),
    courseIds: v.optional(v.array(v.id("courses"))),
  },
  returns: v.id("contacts"),
  handler: async (ctx, args) => {
    await requireSchoolAdmin(ctx, args.familyId);
    const displayName = args.displayName.trim();
    if (!displayName) throw new Error("Name is required");

    const contactId = await ctx.db.insert("contacts", {
      kind: args.kind,
      familyId: args.familyId,
      userId: args.userId,
      studentId: args.studentId,
      displayName,
      emails: (args.emails ?? [])
        .map((e) => e.trim().toLowerCase())
        .filter((e) => e.includes("@")),
      phones: (args.phones ?? []).map((p) => p.trim()).filter(Boolean),
      notes: args.notes?.trim() || undefined,
      roleLabel: args.roleLabel?.trim() || args.kind,
      createdAt: Date.now(),
    });

    if (args.studentIds) {
      await replaceContactStudentLinks(
        ctx,
        contactId,
        args.familyId,
        args.studentIds,
      );
    }
    if (args.courseIds) {
      await replaceContactCourseLinks(
        ctx,
        contactId,
        args.familyId,
        args.courseIds,
      );
    }
    return contactId;
  },
});

export const update = mutation({
  args: {
    contactId: v.id("contacts"),
    displayName: v.optional(v.string()),
    emails: v.optional(v.array(v.string())),
    phones: v.optional(v.array(v.string())),
    notes: v.optional(v.string()),
    roleLabel: v.optional(v.string()),
    kind: v.optional(contactKindValidator),
    studentIds: v.optional(v.array(v.id("students"))),
    courseIds: v.optional(v.array(v.id("courses"))),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const contact = await ctx.db.get("contacts", args.contactId);
    if (!contact) throw new Error("Contact not found");
    if (!contact.familyId) {
      const user = await getCurrentUser(ctx);
      if (user.role !== "superAdmin") {
        throw new Error("Unauthorized");
      }
    } else {
      await requireSchoolAdmin(ctx, contact.familyId);
    }

    const patch: {
      displayName?: string;
      emails?: string[];
      phones?: string[];
      notes?: string;
      roleLabel?: string;
      kind?: typeof args.kind;
      updatedAt: number;
    } = { updatedAt: Date.now() };

    if (args.displayName !== undefined) {
      const name = args.displayName.trim();
      if (!name) throw new Error("Name is required");
      patch.displayName = name;
    }
    if (args.emails !== undefined) {
      patch.emails = args.emails
        .map((e) => e.trim().toLowerCase())
        .filter((e) => e.includes("@"));
    }
    if (args.phones !== undefined) {
      patch.phones = args.phones.map((p) => p.trim()).filter(Boolean);
    }
    if (args.notes !== undefined) {
      patch.notes = args.notes.trim() || undefined;
    }
    if (args.roleLabel !== undefined) {
      patch.roleLabel = args.roleLabel.trim() || undefined;
    }
    if (args.kind !== undefined) {
      patch.kind = args.kind;
    }

    await ctx.db.patch("contacts", args.contactId, patch);

    if (contact.familyId && args.studentIds) {
      await replaceContactStudentLinks(
        ctx,
        args.contactId,
        contact.familyId,
        args.studentIds,
      );
    }
    if (contact.familyId && args.courseIds) {
      await replaceContactCourseLinks(
        ctx,
        args.contactId,
        contact.familyId,
        args.courseIds,
      );
    }

    if (contact.studentId && args.displayName) {
      await ctx.db.patch("students", contact.studentId, {
        displayName: args.displayName.trim(),
      });
    }
    if (contact.userId && args.displayName) {
      await ctx.db.patch("users", contact.userId, {
        name: args.displayName.trim(),
      });
    }
    if (contact.kind === "school" && contact.familyId && args.displayName) {
      await ctx.db.patch("families", contact.familyId, {
        name: args.displayName.trim(),
      });
    }

    return null;
  },
});

export const remove = mutation({
  args: { contactId: v.id("contacts") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const contact = await ctx.db.get("contacts", args.contactId);
    if (!contact) throw new Error("Contact not found");
    if (contact.familyId) {
      await requireSchoolAdmin(ctx, contact.familyId);
    } else {
      const user = await getCurrentUser(ctx);
      if (user.role !== "superAdmin") {
        throw new Error("Unauthorized");
      }
    }
    await deleteContactAndLinks(ctx, args.contactId);
    return null;
  },
});
