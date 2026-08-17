"use node";

import { v } from "convex/values";
import { Scrypt } from "lucia";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { Id } from "./_generated/dataModel";

export const createWithAdultPassword = action({
  args: {
    email: v.string(),
    password: v.string(),
    word: v.string(),
    notes: v.optional(v.string()),
    studentId: v.optional(v.id("students")),
    sessionId: v.optional(v.id("readAlongSessions")),
    storyId: v.optional(v.id("readAlongStories")),
  },
  returns: v.id("speechWordReports"),
  handler: async (ctx, args): Promise<Id<"speechWordReports">> => {
    const callerId = await getAuthUserId(ctx);
    if (callerId === null) {
      throw new Error("Not authenticated");
    }
    const account: { userId: Id<"users">; secret: string } | null =
      await ctx.runQuery(internal.speechReports.findPasswordAccountWithSecret, {
        email: args.email,
      });
    if (!account) {
      throw new Error("Invalid email or password");
    }
    const ok = await new Scrypt().verify(account.secret, args.password);
    if (!ok) {
      throw new Error("Invalid email or password");
    }
    return await ctx.runMutation(internal.speechReports.insertAsReporter, {
      reporterUserId: account.userId,
      word: args.word,
      notes: args.notes,
      studentId: args.studentId,
      sessionId: args.sessionId,
      storyId: args.storyId,
    });
  },
});
