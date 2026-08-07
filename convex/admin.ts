import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getCurrentUser, requireSuperAdmin } from "./lib/auth";
import { userDocValidator } from "./lib/validators";

export const listUsers = query({
  args: {},
  returns: v.array(userDocValidator),
  handler: async (ctx) => {
    await requireSuperAdmin(ctx);
    return await ctx.db.query("users").take(200);
  },
});

export const promoteToSuperAdmin = mutation({
  args: { userId: v.id("users") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);
    const target = await ctx.db.get("users", args.userId);
    if (!target) {
      throw new Error("User not found");
    }
    await ctx.db.patch("users", args.userId, { role: "superAdmin" });
    return null;
  },
});

export const bootstrapSuperAdmin = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    // Dev-only bootstrap: first authenticated user can claim superAdmin
    // if no superAdmin exists yet.
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const existingAdmins = await ctx.db
      .query("users")
      .withIndex("by_role", (q) => q.eq("role", "superAdmin"))
      .take(1);

    if (existingAdmins.length > 0) {
      throw new Error("A superAdmin already exists");
    }

    const user = await getCurrentUser(ctx);
    await ctx.db.patch("users", user._id, { role: "superAdmin" });
    return null;
  },
});
