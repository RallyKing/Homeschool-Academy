import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { createAlert } from "./lib/alerts";
import {
  getCurrentUser,
  getFamilyMembership,
  getPrimaryFamilyForUser,
  requireFamilyAccess,
  requireStudentFamilyAccess,
} from "./lib/auth";
import {
  alertDocValidator,
  alertRecipientTypeValidator,
  alertTypeValidator,
} from "./lib/validators";

type Ctx = QueryCtx | MutationCtx;

async function assertCanAccessAlert(
  ctx: Ctx,
  alert: Doc<"alerts">,
): Promise<Doc<"users">> {
  const user = await getCurrentUser(ctx);

  if (user.role === "superAdmin") {
    return user;
  }

  if (
    alert.recipientType === "user" &&
    alert.recipientUserId === user._id
  ) {
    return user;
  }

  if (alert.recipientType === "family" && alert.familyId) {
    const membership = await getFamilyMembership(
      ctx,
      alert.familyId,
      user._id,
    );
    if (membership) {
      return user;
    }
  }

  if (alert.recipientType === "student" && alert.studentId) {
    const student = await ctx.db.get("students", alert.studentId);
    if (!student) {
      throw new Error("Student not found");
    }
    if (student.userId === user._id) {
      return user;
    }
    const membership = await getFamilyMembership(
      ctx,
      student.familyId,
      user._id,
    );
    if (membership) {
      return user;
    }
  }

  throw new Error("Unauthorized: cannot access this alert");
}

function dedupeById(alerts: Doc<"alerts">[]): Doc<"alerts">[] {
  const seen = new Set<string>();
  const result: Doc<"alerts">[] = [];
  for (const alert of alerts) {
    if (seen.has(alert._id)) continue;
    seen.add(alert._id);
    result.push(alert);
  }
  return result;
}

export const listMine = query({
  args: {
    limit: v.optional(v.number()),
    unreadOnly: v.optional(v.boolean()),
  },
  returns: v.array(alertDocValidator),
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    const limit = Math.min(args.limit ?? 50, 100);
    const role = user.role ?? "parent";
    const collected: Doc<"alerts">[] = [];

    const userAlerts = await ctx.db
      .query("alerts")
      .withIndex("by_user_and_createdAt", (q) =>
        q.eq("recipientUserId", user._id),
      )
      .order("desc")
      .take(limit);
    collected.push(...userAlerts);

    if (role === "parent" || role === "superAdmin") {
      const family = await getPrimaryFamilyForUser(ctx, user._id);
      if (family) {
        const familyAlerts = await ctx.db
          .query("alerts")
          .withIndex("by_family_and_createdAt", (q) =>
            q.eq("familyId", family._id),
          )
          .order("desc")
          .take(limit);
        collected.push(
          ...familyAlerts.filter((a) => a.recipientType === "family"),
        );
      }
    }

    if (role === "student") {
      const linked = await ctx.db
        .query("students")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .first();
      if (linked) {
        const studentAlerts = await ctx.db
          .query("alerts")
          .withIndex("by_student_and_createdAt", (q) =>
            q.eq("studentId", linked._id),
          )
          .order("desc")
          .take(limit);
        collected.push(
          ...studentAlerts.filter((a) => a.recipientType === "student"),
        );
      }
    }

    let merged = dedupeById(collected).sort(
      (a, b) => b.createdAt - a.createdAt,
    );

    if (args.unreadOnly) {
      merged = merged.filter((a) => a.readAt === undefined);
    }

    return merged.slice(0, limit);
  },
});

export const get = query({
  args: { alertId: v.id("alerts") },
  returns: v.union(alertDocValidator, v.null()),
  handler: async (ctx, args) => {
    const alert = await ctx.db.get("alerts", args.alertId);
    if (!alert) return null;
    await assertCanAccessAlert(ctx, alert);
    return alert;
  },
});

export const unreadCount = query({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    const role = user.role ?? "parent";
    const collected: Doc<"alerts">[] = [];

    const userAlerts = await ctx.db
      .query("alerts")
      .withIndex("by_user", (q) => q.eq("recipientUserId", user._id))
      .take(100);
    collected.push(...userAlerts);

    if (role === "parent" || role === "superAdmin") {
      const family = await getPrimaryFamilyForUser(ctx, user._id);
      if (family) {
        const familyAlerts = await ctx.db
          .query("alerts")
          .withIndex("by_family", (q) => q.eq("familyId", family._id))
          .take(100);
        collected.push(
          ...familyAlerts.filter((a) => a.recipientType === "family"),
        );
      }
    }

    if (role === "student") {
      const linked = await ctx.db
        .query("students")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .first();
      if (linked) {
        const studentAlerts = await ctx.db
          .query("alerts")
          .withIndex("by_student", (q) => q.eq("studentId", linked._id))
          .take(100);
        collected.push(
          ...studentAlerts.filter((a) => a.recipientType === "student"),
        );
      }
    }

    return dedupeById(collected).filter((a) => a.readAt === undefined).length;
  },
});

export const create = mutation({
  args: {
    recipientType: alertRecipientTypeValidator,
    recipientUserId: v.optional(v.id("users")),
    familyId: v.optional(v.id("families")),
    studentId: v.optional(v.id("students")),
    type: alertTypeValidator,
    title: v.string(),
    body: v.string(),
    href: v.optional(v.string()),
  },
  returns: v.id("alerts"),
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    const role = user.role ?? "parent";

    if (role === "student") {
      throw new Error("Students cannot create alerts");
    }

    if (args.recipientType === "family") {
      const familyId =
        args.familyId ??
        (await getPrimaryFamilyForUser(ctx, user._id))?._id;
      if (!familyId) {
        throw new Error("No family found");
      }
      await requireFamilyAccess(ctx, familyId);
      return await createAlert(ctx, {
        recipientType: "family",
        familyId,
        studentId: args.studentId,
        type: args.type,
        title: args.title,
        body: args.body,
        href: args.href,
        createdBy: user._id,
      });
    }

    if (args.recipientType === "student") {
      if (!args.studentId) {
        throw new Error("studentId is required for student alerts");
      }
      await requireStudentFamilyAccess(ctx, args.studentId);
      const student = await ctx.db.get("students", args.studentId);
      if (!student) throw new Error("Student not found");
      return await createAlert(ctx, {
        recipientType: "student",
        studentId: args.studentId,
        familyId: student.familyId,
        type: args.type,
        title: args.title,
        body: args.body,
        href: args.href,
        createdBy: user._id,
      });
    }

    // user recipient
    const recipientUserId = args.recipientUserId ?? user._id;
    if (recipientUserId !== user._id && role !== "superAdmin") {
      // Parents may only message linked family students' user accounts
      const membershipFamily = await getPrimaryFamilyForUser(ctx, user._id);
      if (!membershipFamily) {
        throw new Error("Unauthorized");
      }
      const linked = await ctx.db
        .query("students")
        .withIndex("by_user", (q) => q.eq("userId", recipientUserId))
        .first();
      if (!linked || linked.familyId !== membershipFamily._id) {
        throw new Error("Unauthorized: recipient not in your family");
      }
    }

    return await createAlert(ctx, {
      recipientType: "user",
      recipientUserId,
      familyId: args.familyId,
      studentId: args.studentId,
      type: args.type,
      title: args.title,
      body: args.body,
      href: args.href,
      createdBy: user._id,
    });
  },
});

export const update = mutation({
  args: {
    alertId: v.id("alerts"),
    title: v.optional(v.string()),
    body: v.optional(v.string()),
    href: v.optional(v.string()),
    readAt: v.optional(v.union(v.number(), v.null())),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const alert = await ctx.db.get("alerts", args.alertId);
    if (!alert) {
      throw new Error("Alert not found");
    }
    await assertCanAccessAlert(ctx, alert);

    const patch: {
      title?: string;
      body?: string;
      href?: string;
      readAt?: number | undefined;
    } = {};

    if (args.title !== undefined) {
      const title = args.title.trim();
      if (!title) throw new Error("Title is required");
      patch.title = title;
    }
    if (args.body !== undefined) {
      const body = args.body.trim();
      if (!body) throw new Error("Body is required");
      patch.body = body;
    }
    if (args.href !== undefined) {
      patch.href = args.href.trim() || undefined;
    }
    if (args.readAt !== undefined) {
      patch.readAt = args.readAt === null ? undefined : args.readAt;
    }

    await ctx.db.patch("alerts", args.alertId, patch);
    return null;
  },
});

export const markRead = mutation({
  args: {
    alertId: v.id("alerts"),
    now: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const alert = await ctx.db.get("alerts", args.alertId);
    if (!alert) {
      throw new Error("Alert not found");
    }
    await assertCanAccessAlert(ctx, alert);
    if (alert.readAt === undefined) {
      await ctx.db.patch("alerts", args.alertId, { readAt: args.now });
    }
    return null;
  },
});

export const markAllRead = mutation({
  args: { now: v.number() },
  returns: v.number(),
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    const role = user.role ?? "parent";
    const collected: Doc<"alerts">[] = [];

    const userAlerts = await ctx.db
      .query("alerts")
      .withIndex("by_user", (q) => q.eq("recipientUserId", user._id))
      .take(100);
    collected.push(...userAlerts);

    if (role === "parent" || role === "superAdmin") {
      const family = await getPrimaryFamilyForUser(ctx, user._id);
      if (family) {
        const familyAlerts = await ctx.db
          .query("alerts")
          .withIndex("by_family", (q) => q.eq("familyId", family._id))
          .take(100);
        collected.push(
          ...familyAlerts.filter((a) => a.recipientType === "family"),
        );
      }
    }

    if (role === "student") {
      const linked = await ctx.db
        .query("students")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .first();
      if (linked) {
        const studentAlerts = await ctx.db
          .query("alerts")
          .withIndex("by_student", (q) => q.eq("studentId", linked._id))
          .take(100);
        collected.push(
          ...studentAlerts.filter((a) => a.recipientType === "student"),
        );
      }
    }

    let count = 0;
    for (const alert of dedupeById(collected)) {
      if (alert.readAt === undefined) {
        await ctx.db.patch("alerts", alert._id, { readAt: args.now });
        count += 1;
      }
    }
    return count;
  },
});

export const remove = mutation({
  args: { alertId: v.id("alerts") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const alert = await ctx.db.get("alerts", args.alertId);
    if (!alert) {
      throw new Error("Alert not found");
    }
    await assertCanAccessAlert(ctx, alert);
    await ctx.db.delete("alerts", args.alertId);
    return null;
  },
});
