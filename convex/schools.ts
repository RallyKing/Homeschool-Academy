import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import {
  getCurrentUser,
  getPrimaryFamilyForUser,
  listAssignedCourseIds,
  listAssignedStudentIds,
  requireParentOrSchoolAdmin,
  requireRole,
  requireSchoolAdmin,
  resolveSchoolRole,
} from "./lib/auth";
import {
  deleteContactAndLinks,
  replaceContactCourseLinks,
  replaceContactStudentLinks,
  upsertEntityContact,
} from "./lib/contacts";
import { assertSchoolNameAvailable } from "./lib/schoolGuards";
import {
  contactDocValidator,
  familyDocValidator,
  schoolRoleValidator,
  staffKindValidator,
} from "./lib/validators";

const schoolRoleOrSuper = v.union(
  schoolRoleValidator,
  v.literal("superAdmin"),
);

async function findUserByEmail(ctx: MutationCtx, email: string) {
  const normalized = email.trim().toLowerCase();
  const exact = await ctx.db
    .query("users")
    .withIndex("email", (q) => q.eq("email", normalized))
    .unique();
  if (exact) return exact;

  const users = await ctx.db.query("users").take(500);
  return users.find((u) => u.email?.toLowerCase() === normalized) ?? null;
}

async function ensureUserStub(
  ctx: MutationCtx,
  args: {
    email: string;
    name?: string;
    role: "parent" | "teacher" | "student";
  },
): Promise<{ userId: Id<"users">; created: boolean }> {
  const email = args.email.trim().toLowerCase();
  if (!email.includes("@")) {
    throw new Error("Enter a valid email");
  }
  const existing = await findUserByEmail(ctx, email);
  if (existing) {
    if (!existing.role || existing.role === "student") {
      await ctx.db.patch("users", existing._id, { role: args.role });
    }
    if (args.name?.trim() && !existing.name) {
      await ctx.db.patch("users", existing._id, { name: args.name.trim() });
    }
    return { userId: existing._id, created: false };
  }

  const userId = await ctx.db.insert("users", {
    email,
    name: args.name?.trim() || undefined,
    role: args.role,
    createdAt: Date.now(),
  });
  return { userId, created: true };
}

async function ensureSchoolContact(
  ctx: MutationCtx,
  familyId: Id<"families">,
  name: string,
) {
  await upsertEntityContact(ctx, {
    kind: "school",
    familyId,
    displayName: name,
    roleLabel: "school",
  });
}

async function ensureParentContact(
  ctx: MutationCtx,
  args: {
    familyId: Id<"families">;
    userId: Id<"users">;
    schoolRole: "main" | "admin" | "regular";
  },
) {
  const user = await ctx.db.get("users", args.userId);
  await upsertEntityContact(ctx, {
    kind: "parent",
    familyId: args.familyId,
    userId: args.userId,
    displayName: user?.name || user?.email || "Parent",
    emails: user?.email ? [user.email] : [],
    phones: user?.phone ? [user.phone] : [],
    roleLabel: args.schoolRole,
  });
}

export const listMine = query({
  args: {},
  returns: v.array(
    v.object({
      family: familyDocValidator,
      schoolRole: v.union(schoolRoleValidator, v.null()),
      isStaff: v.boolean(),
      staffKind: v.optional(staffKindValidator),
    }),
  ),
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    const seen = new Map<
      string,
      {
        family: Doc<"families">;
        schoolRole: "main" | "admin" | "regular" | null;
        isStaff: boolean;
        staffKind?: "teacher" | "tutor";
      }
    >();

    if (user.role === "superAdmin") {
      const families = await ctx.db.query("families").take(200);
      return families.map((family) => ({
        family,
        schoolRole: "main" as const,
        isStaff: false,
      }));
    }

    const memberships = await ctx.db
      .query("familyMembers")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    for (const membership of memberships) {
      const family = await ctx.db.get("families", membership.familyId);
      if (!family) continue;
      seen.set(family._id, {
        family,
        schoolRole: resolveSchoolRole(membership, family, user._id),
        isStaff: false,
      });
    }

    const staffRows = await ctx.db
      .query("schoolStaff")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    for (const row of staffRows) {
      const family = await ctx.db.get("families", row.familyId);
      if (!family) continue;
      const existing = seen.get(family._id);
      if (existing) {
        existing.isStaff = true;
        existing.staffKind = row.memberKind;
      } else {
        seen.set(family._id, {
          family,
          schoolRole: null,
          isStaff: true,
          staffKind: row.memberKind,
        });
      }
    }

    return Array.from(seen.values());
  },
});

export const getCapabilities = query({
  args: { familyId: v.optional(v.id("families")) },
  returns: v.object({
    familyId: v.union(v.id("families"), v.null()),
    canManageAccounts: v.boolean(),
    canAddSchool: v.boolean(),
    canAddParents: v.boolean(),
    canAddTeachers: v.boolean(),
    canManageStudents: v.boolean(),
    canManageContacts: v.boolean(),
    schoolRole: v.union(schoolRoleOrSuper, v.null()),
    isStaff: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    const isGod = user.role === "superAdmin";
    let familyId = args.familyId;
    if (!familyId) {
      const primary = await getPrimaryFamilyForUser(ctx, user._id);
      familyId = primary?._id;
    }

    if (!familyId) {
      return {
        familyId: null,
        canManageAccounts: isGod,
        canAddSchool: isGod,
        canAddParents: false,
        canAddTeachers: false,
        canManageStudents: false,
        canManageContacts: isGod,
        schoolRole: isGod ? ("superAdmin" as const) : null,
        isStaff: false,
      };
    }

    const family = await ctx.db.get("families", familyId);
    if (!family) {
      throw new Error("School not found");
    }

    const membership = await ctx.db
      .query("familyMembers")
      .withIndex("by_family_and_user", (q) =>
        q.eq("familyId", familyId!).eq("userId", user._id),
      )
      .unique();
    const staff = await ctx.db
      .query("schoolStaff")
      .withIndex("by_family_and_user", (q) =>
        q.eq("familyId", familyId!).eq("userId", user._id),
      )
      .unique();

    const schoolRole = isGod
      ? ("superAdmin" as const)
      : resolveSchoolRole(membership, family, user._id);
    const isAdmin = isGod || schoolRole === "main" || schoolRole === "admin";
    const isParent = Boolean(membership) || isGod;

    return {
      familyId,
      canManageAccounts: isAdmin,
      canAddSchool: isGod,
      canAddParents: isAdmin,
      canAddTeachers: isAdmin,
      canManageStudents: isParent,
      canManageContacts: isAdmin || Boolean(staff),
      schoolRole: schoolRole ?? null,
      isStaff: Boolean(staff),
    };
  },
});

export const createWithMainParent = mutation({
  args: {
    schoolName: v.string(),
    mainParentEmail: v.string(),
    mainParentName: v.optional(v.string()),
    mainParentPhone: v.optional(v.string()),
    allowDuplicateName: v.optional(v.boolean()),
  },
  returns: v.object({
    familyId: v.id("families"),
    mainParentUserId: v.id("users"),
    createdUser: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const actor = await requireRole(ctx, ["superAdmin", "parent"]);
    const schoolName = args.schoolName.trim();
    if (!schoolName) {
      throw new Error("School name is required");
    }
    await assertSchoolNameAvailable(ctx, {
      name: schoolName,
      allowDuplicateName: args.allowDuplicateName,
    });

    if (actor.role !== "superAdmin") {
      const existing = await getPrimaryFamilyForUser(ctx, actor._id);
      if (existing) {
        throw new Error(
          "You already have a school. Ask a SuperAdmin to create additional schools.",
        );
      }
    }

    const { userId, created } = await ensureUserStub(ctx, {
      email: args.mainParentEmail,
      name: args.mainParentName,
      role: "parent",
    });
    if (args.mainParentPhone?.trim()) {
      await ctx.db.patch("users", userId, {
        phone: args.mainParentPhone.trim(),
      });
    }

    const now = Date.now();
    const familyId = await ctx.db.insert("families", {
      name: schoolName,
      createdBy: actor._id,
      mainParentUserId: userId,
      createdAt: now,
    });

    await ctx.db.insert("familyMembers", {
      familyId,
      userId,
      role: "parent",
      schoolRole: "main",
      createdAt: now,
    });

    if (actor.role === "superAdmin" && actor._id !== userId) {
      const actorMembership = await ctx.db
        .query("familyMembers")
        .withIndex("by_family_and_user", (q) =>
          q.eq("familyId", familyId).eq("userId", actor._id),
        )
        .unique();
      if (!actorMembership) {
        await ctx.db.insert("familyMembers", {
          familyId,
          userId: actor._id,
          role: "parent",
          schoolRole: "admin",
          createdAt: now,
        });
      }
    }

    await ensureSchoolContact(ctx, familyId, schoolName);
    await ensureParentContact(ctx, {
      familyId,
      userId,
      schoolRole: "main",
    });

    return { familyId, mainParentUserId: userId, createdUser: created };
  },
});

export const addParent = mutation({
  args: {
    familyId: v.id("families"),
    email: v.string(),
    name: v.optional(v.string()),
    phone: v.optional(v.string()),
    schoolRole: v.union(v.literal("admin"), v.literal("regular")),
  },
  returns: v.object({
    membershipId: v.id("familyMembers"),
    userId: v.id("users"),
    createdUser: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const { schoolRole: actorRole } = await requireSchoolAdmin(
      ctx,
      args.familyId,
    );
    if (args.schoolRole === "admin" && actorRole === "admin") {
      // admin parents may add regular or admin; allowed
    }

    const family = await ctx.db.get("families", args.familyId);
    if (!family) throw new Error("Create a school before adding parents");

    const { userId, created } = await ensureUserStub(ctx, {
      email: args.email,
      name: args.name,
      role: "parent",
    });
    if (args.phone?.trim()) {
      await ctx.db.patch("users", userId, { phone: args.phone.trim() });
    }

    const existing = await ctx.db
      .query("familyMembers")
      .withIndex("by_family_and_user", (q) =>
        q.eq("familyId", args.familyId).eq("userId", userId),
      )
      .unique();
    if (existing) {
      await ctx.db.patch("familyMembers", existing._id, {
        schoolRole: args.schoolRole,
        role: "parent",
      });
      await ensureParentContact(ctx, {
        familyId: args.familyId,
        userId,
        schoolRole: args.schoolRole,
      });
      return {
        membershipId: existing._id,
        userId,
        createdUser: created,
      };
    }

    const membershipId = await ctx.db.insert("familyMembers", {
      familyId: args.familyId,
      userId,
      role: "parent",
      schoolRole: args.schoolRole,
      createdAt: Date.now(),
    });
    await ensureParentContact(ctx, {
      familyId: args.familyId,
      userId,
      schoolRole: args.schoolRole,
    });
    return { membershipId, userId, createdUser: created };
  },
});

export const updateParentRole = mutation({
  args: {
    familyId: v.id("families"),
    userId: v.id("users"),
    schoolRole: v.union(v.literal("admin"), v.literal("regular")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { family } = await requireSchoolAdmin(ctx, args.familyId);
    if (
      args.userId === family.mainParentUserId ||
      args.userId === family.createdBy
    ) {
      throw new Error("Cannot change the main parent's school role here");
    }
    const membership = await ctx.db
      .query("familyMembers")
      .withIndex("by_family_and_user", (q) =>
        q.eq("familyId", args.familyId).eq("userId", args.userId),
      )
      .unique();
    if (!membership) throw new Error("Parent not found");
    await ctx.db.patch("familyMembers", membership._id, {
      schoolRole: args.schoolRole,
    });
    await ensureParentContact(ctx, {
      familyId: args.familyId,
      userId: args.userId,
      schoolRole: args.schoolRole,
    });
    return null;
  },
});

export const removeParent = mutation({
  args: {
    familyId: v.id("families"),
    userId: v.id("users"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { family } = await requireSchoolAdmin(ctx, args.familyId);
    if (
      args.userId === family.mainParentUserId ||
      args.userId === family.createdBy
    ) {
      throw new Error("Cannot remove the main parent");
    }
    const membership = await ctx.db
      .query("familyMembers")
      .withIndex("by_family_and_user", (q) =>
        q.eq("familyId", args.familyId).eq("userId", args.userId),
      )
      .unique();
    if (!membership) throw new Error("Parent not found");
    await ctx.db.delete("familyMembers", membership._id);

    const contacts = await ctx.db
      .query("contacts")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    for (const contact of contacts) {
      if (contact.familyId === args.familyId && contact.kind === "parent") {
        await deleteContactAndLinks(ctx, contact._id);
      }
    }
    return null;
  },
});

export const addTeacher = mutation({
  args: {
    familyId: v.id("families"),
    email: v.string(),
    name: v.optional(v.string()),
    phone: v.optional(v.string()),
    memberKind: staffKindValidator,
    studentIds: v.array(v.id("students")),
    courseIds: v.array(v.id("courses")),
    notes: v.optional(v.string()),
  },
  returns: v.object({
    staffId: v.id("schoolStaff"),
    userId: v.id("users"),
    createdUser: v.boolean(),
  }),
  handler: async (ctx, args) => {
    await requireSchoolAdmin(ctx, args.familyId);
    const family = await ctx.db.get("families", args.familyId);
    if (!family) throw new Error("Create a school before adding teachers");

    const { userId, created } = await ensureUserStub(ctx, {
      email: args.email,
      name: args.name,
      role: "teacher",
    });
    if (args.phone?.trim()) {
      await ctx.db.patch("users", userId, { phone: args.phone.trim() });
    }

    let staff = await ctx.db
      .query("schoolStaff")
      .withIndex("by_family_and_user", (q) =>
        q.eq("familyId", args.familyId).eq("userId", userId),
      )
      .unique();
    if (staff) {
      await ctx.db.patch("schoolStaff", staff._id, {
        memberKind: args.memberKind,
      });
    } else {
      const staffId = await ctx.db.insert("schoolStaff", {
        familyId: args.familyId,
        userId,
        memberKind: args.memberKind,
        createdAt: Date.now(),
      });
      staff = await ctx.db.get("schoolStaff", staffId);
    }
    if (!staff) throw new Error("Could not save teacher");

    await replaceTeacherAssignments(ctx, {
      familyId: args.familyId,
      teacherUserId: userId,
      studentIds: args.studentIds,
      courseIds: args.courseIds,
    });

    const contactId = await upsertEntityContact(ctx, {
      kind: args.memberKind,
      familyId: args.familyId,
      userId,
      displayName: args.name?.trim() || args.email.trim(),
      emails: [args.email],
      phones: args.phone ? [args.phone] : [],
      notes: args.notes,
      roleLabel: args.memberKind,
    });
    await replaceContactStudentLinks(
      ctx,
      contactId,
      args.familyId,
      args.studentIds,
    );
    await replaceContactCourseLinks(
      ctx,
      contactId,
      args.familyId,
      args.courseIds,
    );

    return { staffId: staff._id, userId, createdUser: created };
  },
});

async function replaceTeacherAssignments(
  ctx: MutationCtx,
  args: {
    familyId: Id<"families">;
    teacherUserId: Id<"users">;
    studentIds: Id<"students">[];
    courseIds: Id<"courses">[];
  },
) {
  const existingStudents = await ctx.db
    .query("teacherStudentAccess")
    .withIndex("by_family_and_teacher", (q) =>
      q
        .eq("familyId", args.familyId)
        .eq("teacherUserId", args.teacherUserId),
    )
    .collect();
  for (const row of existingStudents) {
    await ctx.db.delete("teacherStudentAccess", row._id);
  }
  const existingCourses = await ctx.db
    .query("teacherCourseAccess")
    .withIndex("by_family_and_teacher", (q) =>
      q
        .eq("familyId", args.familyId)
        .eq("teacherUserId", args.teacherUserId),
    )
    .collect();
  for (const row of existingCourses) {
    await ctx.db.delete("teacherCourseAccess", row._id);
  }

  const seenStudents = new Set<string>();
  for (const studentId of args.studentIds) {
    if (seenStudents.has(studentId)) continue;
    seenStudents.add(studentId);
    const student = await ctx.db.get("students", studentId);
    if (!student || student.familyId !== args.familyId) {
      throw new Error("Student is not in this school");
    }
    await ctx.db.insert("teacherStudentAccess", {
      familyId: args.familyId,
      teacherUserId: args.teacherUserId,
      studentId,
      createdAt: Date.now(),
    });
  }

  const seenCourses = new Set<string>();
  for (const courseId of args.courseIds) {
    if (seenCourses.has(courseId)) continue;
    seenCourses.add(courseId);
    const course = await ctx.db.get("courses", courseId);
    if (!course) throw new Error("Course not found");
    const inSchool =
      course.familyId === args.familyId || course.academyId !== undefined;
    if (!inSchool) {
      throw new Error("Course is not available to this school");
    }
    await ctx.db.insert("teacherCourseAccess", {
      familyId: args.familyId,
      teacherUserId: args.teacherUserId,
      courseId,
      createdAt: Date.now(),
    });
  }
}

export const updateTeacher = mutation({
  args: {
    familyId: v.id("families"),
    userId: v.id("users"),
    name: v.optional(v.string()),
    phone: v.optional(v.string()),
    memberKind: v.optional(staffKindValidator),
    studentIds: v.optional(v.array(v.id("students"))),
    courseIds: v.optional(v.array(v.id("courses"))),
    notes: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireSchoolAdmin(ctx, args.familyId);
    const staff = await ctx.db
      .query("schoolStaff")
      .withIndex("by_family_and_user", (q) =>
        q.eq("familyId", args.familyId).eq("userId", args.userId),
      )
      .unique();
    if (!staff) throw new Error("Teacher not found at this school");

    if (args.memberKind) {
      await ctx.db.patch("schoolStaff", staff._id, {
        memberKind: args.memberKind,
      });
    }
    const patch: { name?: string; phone?: string } = {};
    if (args.name !== undefined) patch.name = args.name.trim() || undefined;
    if (args.phone !== undefined) patch.phone = args.phone.trim() || undefined;
    if (Object.keys(patch).length > 0) {
      await ctx.db.patch("users", args.userId, patch);
    }

    if (args.studentIds || args.courseIds) {
      const currentStudents = await listAssignedStudentIds(
        ctx,
        args.userId,
        args.familyId,
      );
      const currentCourses = await listAssignedCourseIds(
        ctx,
        args.userId,
        args.familyId,
      );
      await replaceTeacherAssignments(ctx, {
        familyId: args.familyId,
        teacherUserId: args.userId,
        studentIds: args.studentIds ?? currentStudents,
        courseIds: args.courseIds ?? currentCourses,
      });
    }

    const user = await ctx.db.get("users", args.userId);
    const kind = args.memberKind ?? staff.memberKind;
    const contactId = await upsertEntityContact(ctx, {
      kind,
      familyId: args.familyId,
      userId: args.userId,
      displayName: user?.name || user?.email || "Teacher",
      emails: user?.email ? [user.email] : [],
      phones: user?.phone ? [user.phone] : [],
      notes: args.notes,
      roleLabel: kind,
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
    return null;
  },
});

export const removeTeacher = mutation({
  args: {
    familyId: v.id("families"),
    userId: v.id("users"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireSchoolAdmin(ctx, args.familyId);
    const staff = await ctx.db
      .query("schoolStaff")
      .withIndex("by_family_and_user", (q) =>
        q.eq("familyId", args.familyId).eq("userId", args.userId),
      )
      .unique();
    if (!staff) throw new Error("Teacher not found");

    await replaceTeacherAssignments(ctx, {
      familyId: args.familyId,
      teacherUserId: args.userId,
      studentIds: [],
      courseIds: [],
    });
    await ctx.db.delete("schoolStaff", staff._id);

    const contacts = await ctx.db
      .query("contacts")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    for (const contact of contacts) {
      if (
        contact.familyId === args.familyId &&
        (contact.kind === "teacher" || contact.kind === "tutor")
      ) {
        await deleteContactAndLinks(ctx, contact._id);
      }
    }
    return null;
  },
});

export const listParents = query({
  args: { familyId: v.id("families") },
  returns: v.array(
    v.object({
      membershipId: v.id("familyMembers"),
      userId: v.id("users"),
      schoolRole: schoolRoleValidator,
      email: v.optional(v.string()),
      name: v.optional(v.string()),
      phone: v.optional(v.string()),
      isMain: v.boolean(),
      createdAt: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    await requireParentOrSchoolAdmin(ctx, args.familyId);
    const family = await ctx.db.get("families", args.familyId);
    if (!family) return [];
    const members = await ctx.db
      .query("familyMembers")
      .withIndex("by_family", (q) => q.eq("familyId", args.familyId))
      .collect();
    const result = [];
    for (const membership of members) {
      const u = await ctx.db.get("users", membership.userId);
      const schoolRole = resolveSchoolRole(
        membership,
        family,
        membership.userId,
      );
      result.push({
        membershipId: membership._id,
        userId: membership.userId,
        schoolRole: schoolRole ?? "regular",
        email: u?.email,
        name: u?.name,
        phone: u?.phone,
        isMain:
          membership.userId === family.mainParentUserId ||
          membership.userId === family.createdBy,
        createdAt: membership.createdAt,
      });
    }
    return result.sort((a, b) => {
      const rank = { main: 0, admin: 1, regular: 2 };
      return rank[a.schoolRole] - rank[b.schoolRole];
    });
  },
});

export const listTeachers = query({
  args: { familyId: v.id("families") },
  returns: v.array(
    v.object({
      staffId: v.id("schoolStaff"),
      userId: v.id("users"),
      memberKind: staffKindValidator,
      email: v.optional(v.string()),
      name: v.optional(v.string()),
      phone: v.optional(v.string()),
      studentIds: v.array(v.id("students")),
      courseIds: v.array(v.id("courses")),
      createdAt: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    await requireParentOrSchoolAdmin(ctx, args.familyId);
    const staff = await ctx.db
      .query("schoolStaff")
      .withIndex("by_family", (q) => q.eq("familyId", args.familyId))
      .collect();
    const result = [];
    for (const row of staff) {
      const u = await ctx.db.get("users", row.userId);
      result.push({
        staffId: row._id,
        userId: row.userId,
        memberKind: row.memberKind,
        email: u?.email,
        name: u?.name,
        phone: u?.phone,
        studentIds: await listAssignedStudentIds(
          ctx,
          row.userId,
          args.familyId,
        ),
        courseIds: await listAssignedCourseIds(ctx, row.userId, args.familyId),
        createdAt: row.createdAt,
      });
    }
    return result;
  },
});

export const listAssignedStudents = query({
  args: { familyId: v.optional(v.id("families")) },
  returns: v.array(contactDocValidator),
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (user.role === "superAdmin" || user.role === "parent") {
      return [];
    }
    const studentIds = await listAssignedStudentIds(ctx, user._id, args.familyId);
    const contacts = [];
    for (const studentId of studentIds) {
      const student = await ctx.db.get("students", studentId);
      if (!student) continue;
      const contact = await ctx.db
        .query("contacts")
        .withIndex("by_student", (q) => q.eq("studentId", studentId))
        .first();
      if (contact) contacts.push(contact);
    }
    return contacts;
  },
});

export const backfillHierarchy = mutation({
  args: { familyId: v.optional(v.id("families")) },
  returns: v.object({
    families: v.number(),
    members: v.number(),
    contacts: v.number(),
  }),
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    const families = args.familyId
      ? [await ctx.db.get("families", args.familyId)]
      : user.role === "superAdmin"
        ? await ctx.db.query("families").take(200)
        : [];

    if (!args.familyId && user.role !== "superAdmin") {
      const primary = await getPrimaryFamilyForUser(ctx, user._id);
      if (primary) families.push(primary);
    }

    let memberCount = 0;
    let contactCount = 0;
    let familyCount = 0;

    for (const family of families) {
      if (!family) continue;
      familyCount += 1;
      const mainId = family.mainParentUserId ?? family.createdBy;
      if (!family.mainParentUserId) {
        await ctx.db.patch("families", family._id, {
          mainParentUserId: mainId,
        });
      }
      await ensureSchoolContact(ctx, family._id, family.name);
      contactCount += 1;

      const members = await ctx.db
        .query("familyMembers")
        .withIndex("by_family", (q) => q.eq("familyId", family._id))
        .collect();
      for (const membership of members) {
        memberCount += 1;
        const schoolRole =
          membership.userId === mainId ? "main" : (membership.schoolRole ?? "regular");
        if (!membership.schoolRole) {
          await ctx.db.patch("familyMembers", membership._id, { schoolRole });
        }
        await ensureParentContact(ctx, {
          familyId: family._id,
          userId: membership.userId,
          schoolRole,
        });
        contactCount += 1;
      }

      const students = await ctx.db
        .query("students")
        .withIndex("by_family", (q) => q.eq("familyId", family._id))
        .collect();
      for (const student of students) {
        await upsertEntityContact(ctx, {
          kind: "student",
          familyId: family._id,
          userId: student.userId,
          studentId: student._id,
          displayName: student.displayName,
          roleLabel: "student",
        });
        contactCount += 1;
      }
    }

    // Only give a superAdmin a standalone platform card when they don't already
    // appear in the directory through a school — otherwise the same human shows
    // up twice.
    if (user.role === "superAdmin") {
      const existing = await ctx.db
        .query("contacts")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .first();
      if (!existing) {
        await upsertEntityContact(ctx, {
          kind: "user",
          userId: user._id,
          displayName: user.name || user.email || "SuperAdmin",
          emails: user.email ? [user.email] : [],
          roleLabel: "superAdmin",
        });
        contactCount += 1;
      }
    }

    return { families: familyCount, members: memberCount, contacts: contactCount };
  },
});
