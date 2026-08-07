import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import {
  requireFamilyAccess,
  requireRole,
  requireStudentFamilyAccess,
} from "../lib/auth";

const proposalStatusValidator = v.union(
  v.literal("pending"),
  v.literal("accepted"),
  v.literal("rejected"),
);

const proposalDocValidator = v.object({
  _id: v.id("badgeProposals"),
  _creationTime: v.number(),
  familyId: v.id("families"),
  studentId: v.id("students"),
  key: v.string(),
  title: v.string(),
  description: v.string(),
  iconHint: v.string(),
  criteriaSummary: v.string(),
  ageBand: v.string(),
  status: proposalStatusValidator,
  acceptedBadgeId: v.optional(v.id("badges")),
  createdAt: v.number(),
  updatedAt: v.optional(v.number()),
});

export const listProposals = query({
  args: {
    familyId: v.id("families"),
    status: v.optional(proposalStatusValidator),
  },
  returns: v.array(proposalDocValidator),
  handler: async (ctx, args) => {
    await requireFamilyAccess(ctx, args.familyId);
    if (args.status) {
      return await ctx.db
        .query("badgeProposals")
        .withIndex("by_family_and_status", (q) =>
          q.eq("familyId", args.familyId).eq("status", args.status!),
        )
        .collect();
    }
    return await ctx.db
      .query("badgeProposals")
      .withIndex("by_family", (q) => q.eq("familyId", args.familyId))
      .collect();
  },
});

export const listForStudent = query({
  args: {
    studentId: v.id("students"),
    status: v.optional(proposalStatusValidator),
  },
  returns: v.array(proposalDocValidator),
  handler: async (ctx, args) => {
    await requireStudentFamilyAccess(ctx, args.studentId);
    const rows = await ctx.db
      .query("badgeProposals")
      .withIndex("by_student", (q) => q.eq("studentId", args.studentId))
      .collect();
    if (args.status) {
      return rows.filter((r) => r.status === args.status);
    }
    return rows;
  },
});

export const get = query({
  args: { proposalId: v.id("badgeProposals") },
  returns: v.union(proposalDocValidator, v.null()),
  handler: async (ctx, args) => {
    const proposal = await ctx.db.get("badgeProposals", args.proposalId);
    if (!proposal) return null;
    await requireFamilyAccess(ctx, proposal.familyId);
    return proposal;
  },
});

/** Create a pending proposal (used by craft action via runMutation, or parent manually). */
export const create = mutation({
  args: {
    studentId: v.id("students"),
    key: v.string(),
    title: v.string(),
    description: v.string(),
    iconHint: v.string(),
    criteriaSummary: v.string(),
    ageBand: v.string(),
  },
  returns: v.id("badgeProposals"),
  handler: async (ctx, args) => {
    const { user, student } = await requireStudentFamilyAccess(
      ctx,
      args.studentId,
    );
    if (user.role !== "parent" && user.role !== "superAdmin") {
      throw new Error("Only parents can create badge proposals");
    }

    const key = args.key.trim().toLowerCase().replace(/\s+/g, "_");
    const title = args.title.trim();
    if (!key || !title) throw new Error("Key and title are required");

    return await ctx.db.insert("badgeProposals", {
      familyId: student.familyId,
      studentId: student._id,
      key,
      title,
      description: args.description.trim(),
      iconHint: args.iconHint.trim() || "star",
      criteriaSummary: args.criteriaSummary.trim(),
      ageBand: args.ageBand.trim() || "mixed",
      status: "pending",
      createdAt: Date.now(),
    });
  },
});

export const update = mutation({
  args: {
    proposalId: v.id("badgeProposals"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    iconHint: v.optional(v.string()),
    criteriaSummary: v.optional(v.string()),
    ageBand: v.optional(v.string()),
    status: v.optional(proposalStatusValidator),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireRole(ctx, ["parent", "superAdmin"]);
    const proposal = await ctx.db.get("badgeProposals", args.proposalId);
    if (!proposal) throw new Error("Proposal not found");
    await requireFamilyAccess(ctx, proposal.familyId);

    const patch: {
      title?: string;
      description?: string;
      iconHint?: string;
      criteriaSummary?: string;
      ageBand?: string;
      status?: "pending" | "accepted" | "rejected";
      updatedAt: number;
    } = { updatedAt: Date.now() };

    if (args.title !== undefined) {
      const title = args.title.trim();
      if (!title) throw new Error("Title is required");
      patch.title = title;
    }
    if (args.description !== undefined) {
      patch.description = args.description.trim();
    }
    if (args.iconHint !== undefined) patch.iconHint = args.iconHint.trim();
    if (args.criteriaSummary !== undefined) {
      patch.criteriaSummary = args.criteriaSummary.trim();
    }
    if (args.ageBand !== undefined) patch.ageBand = args.ageBand.trim();
    if (args.status !== undefined) patch.status = args.status;

    await ctx.db.patch("badgeProposals", args.proposalId, patch);
    return null;
  },
});

export const remove = mutation({
  args: { proposalId: v.id("badgeProposals") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireRole(ctx, ["parent", "superAdmin"]);
    const proposal = await ctx.db.get("badgeProposals", args.proposalId);
    if (!proposal) throw new Error("Proposal not found");
    await requireFamilyAccess(ctx, proposal.familyId);
    await ctx.db.delete("badgeProposals", args.proposalId);
    return null;
  },
});

export const reject = mutation({
  args: { proposalId: v.id("badgeProposals") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireRole(ctx, ["parent", "superAdmin"]);
    const proposal = await ctx.db.get("badgeProposals", args.proposalId);
    if (!proposal) throw new Error("Proposal not found");
    await requireFamilyAccess(ctx, proposal.familyId);
    if (proposal.status !== "pending") {
      throw new Error("Only pending proposals can be rejected");
    }
    await ctx.db.patch("badgeProposals", args.proposalId, {
      status: "rejected",
      updatedAt: Date.now(),
    });
    return null;
  },
});

/**
 * Parent accepts AI proposal → creates a family custom badge + grants to student.
 */
export const accept = mutation({
  args: {
    proposalId: v.id("badgeProposals"),
    grantToStudent: v.optional(v.boolean()),
  },
  returns: v.id("badges"),
  handler: async (ctx, args) => {
    await requireRole(ctx, ["parent", "superAdmin"]);
    const proposal = await ctx.db.get("badgeProposals", args.proposalId);
    if (!proposal) throw new Error("Proposal not found");
    await requireFamilyAccess(ctx, proposal.familyId);
    if (proposal.status !== "pending") {
      throw new Error("Only pending proposals can be accepted");
    }

    const key = `custom_${proposal.familyId}_${proposal.key}`.slice(0, 64);
    const existing = await ctx.db
      .query("badges")
      .withIndex("by_key", (q) => q.eq("key", key))
      .unique();
    if (existing) {
      throw new Error("A badge with that key already exists — edit the proposal key");
    }

    const badgeId = await ctx.db.insert("badges", {
      key,
      title: proposal.title,
      description: proposal.description,
      iconKey: proposal.iconHint,
      criteriaType: "manual",
      familyId: proposal.familyId,
      ageBand: proposal.ageBand,
      source: "ai",
      criteriaSummary: proposal.criteriaSummary,
      xpReward: 25,
      pointsReward: 5,
      createdAt: Date.now(),
    });

    const shouldGrant = args.grantToStudent !== false;
    if (shouldGrant) {
      const already = await ctx.db
        .query("studentBadges")
        .withIndex("by_student_and_badge", (q) =>
          q.eq("studentId", proposal.studentId).eq("badgeId", badgeId),
        )
        .unique();
      if (!already) {
        await ctx.db.insert("studentBadges", {
          studentId: proposal.studentId,
          badgeId,
          earnedAt: Date.now(),
          createdAt: Date.now(),
        });
      }
    }

    await ctx.db.patch("badgeProposals", args.proposalId, {
      status: "accepted",
      acceptedBadgeId: badgeId,
      updatedAt: Date.now(),
    });

    return badgeId;
  },
});
