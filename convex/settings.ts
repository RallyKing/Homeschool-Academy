import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getCurrentUser } from "./lib/auth";

const userSettingsDocValidator = v.object({
  _id: v.id("userSettings"),
  _creationTime: v.number(),
  userId: v.id("users"),
  notifyAlerts: v.optional(v.boolean()),
  notifyChores: v.optional(v.boolean()),
  notifyKudos: v.optional(v.boolean()),
  notifyAi: v.optional(v.boolean()),
  updatedAt: v.number(),
});

const prefsReturnValidator = v.object({
  notifyAlerts: v.boolean(),
  notifyChores: v.boolean(),
  notifyKudos: v.boolean(),
  notifyAi: v.boolean(),
});

function withDefaults(
  doc:
    | {
        notifyAlerts?: boolean;
        notifyChores?: boolean;
        notifyKudos?: boolean;
        notifyAi?: boolean;
      }
    | null
    | undefined,
) {
  return {
    notifyAlerts: doc?.notifyAlerts ?? true,
    notifyChores: doc?.notifyChores ?? true,
    notifyKudos: doc?.notifyKudos ?? true,
    notifyAi: doc?.notifyAi ?? true,
  };
}

export const getMine = query({
  args: {},
  returns: prefsReturnValidator,
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    const doc = await ctx.db
      .query("userSettings")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();
    return withDefaults(doc);
  },
});

export const getMineDoc = query({
  args: {},
  returns: v.union(userSettingsDocValidator, v.null()),
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    return await ctx.db
      .query("userSettings")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();
  },
});

export const updateMine = mutation({
  args: {
    notifyAlerts: v.optional(v.boolean()),
    notifyChores: v.optional(v.boolean()),
    notifyKudos: v.optional(v.boolean()),
    notifyAi: v.optional(v.boolean()),
  },
  returns: prefsReturnValidator,
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    const existing = await ctx.db
      .query("userSettings")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();

    const updatedAt = Date.now();

    if (existing) {
      const patch: {
        notifyAlerts?: boolean;
        notifyChores?: boolean;
        notifyKudos?: boolean;
        notifyAi?: boolean;
        updatedAt: number;
      } = { updatedAt };
      if (args.notifyAlerts !== undefined) patch.notifyAlerts = args.notifyAlerts;
      if (args.notifyChores !== undefined) patch.notifyChores = args.notifyChores;
      if (args.notifyKudos !== undefined) patch.notifyKudos = args.notifyKudos;
      if (args.notifyAi !== undefined) patch.notifyAi = args.notifyAi;
      await ctx.db.patch("userSettings", existing._id, patch);
      const updated = await ctx.db.get("userSettings", existing._id);
      return withDefaults(updated);
    }

    await ctx.db.insert("userSettings", {
      userId: user._id,
      notifyAlerts: args.notifyAlerts ?? true,
      notifyChores: args.notifyChores ?? true,
      notifyKudos: args.notifyKudos ?? true,
      notifyAi: args.notifyAi ?? true,
      updatedAt,
    });

    return withDefaults({
      notifyAlerts: args.notifyAlerts ?? true,
      notifyChores: args.notifyChores ?? true,
      notifyKudos: args.notifyKudos ?? true,
      notifyAi: args.notifyAi ?? true,
    });
  },
});
