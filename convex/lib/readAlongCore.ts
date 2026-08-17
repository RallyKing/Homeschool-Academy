import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { reverseAwardsForSource } from "./gamificationCore";

/** 1 point per this many correctly read words. */
export const READ_ALONG_WORDS_PER_POINT = 5;
export const READ_ALONG_POINTS_PER_PRACTICE = 1;

export function tokenizeStory(body: string): string[] {
  return body
    .replace(/\r\n/g, "\n")
    .split(/\s+/)
    .map((w) => w.trim())
    .filter(Boolean);
}

export function pointsForCorrectWords(wordsCorrect: number): number {
  return Math.floor(Math.max(0, wordsCorrect) / READ_ALONG_WORDS_PER_POINT);
}

export async function deleteWordEventsForSession(
  ctx: MutationCtx,
  sessionId: Id<"readAlongSessions">,
): Promise<void> {
  const events = await ctx.db
    .query("readAlongWordEvents")
    .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
    .collect();
  for (const event of events) {
    await ctx.db.delete("readAlongWordEvents", event._id);
  }
}

export async function deleteReadAlongSession(
  ctx: MutationCtx,
  sessionId: Id<"readAlongSessions">,
): Promise<void> {
  const session = await ctx.db.get("readAlongSessions", sessionId);
  if (!session) return;

  await reverseAwardsForSource(ctx, {
    studentId: session.studentId,
    familyId: session.familyId,
    sourceType: "read_along",
    sourceId: sessionId,
  });
  await deleteWordEventsForSession(ctx, sessionId);
  await ctx.db.delete("readAlongSessions", sessionId);
}

export async function deleteReadAlongStory(
  ctx: MutationCtx,
  storyId: Id<"readAlongStories">,
): Promise<void> {
  const sessions = await ctx.db
    .query("readAlongSessions")
    .withIndex("by_story", (q) => q.eq("storyId", storyId))
    .collect();
  for (const session of sessions) {
    await deleteReadAlongSession(ctx, session._id);
  }
  await ctx.db.delete("readAlongStories", storyId);
}

export async function deleteReadAlongForStudent(
  ctx: MutationCtx,
  studentId: Id<"students">,
): Promise<void> {
  const sessions = await ctx.db
    .query("readAlongSessions")
    .withIndex("by_student", (q) => q.eq("studentId", studentId))
    .collect();
  for (const session of sessions) {
    await deleteReadAlongSession(ctx, session._id);
  }

  const stories = await ctx.db
    .query("readAlongStories")
    .withIndex("by_student", (q) => q.eq("studentId", studentId))
    .collect();
  for (const story of stories) {
    await deleteReadAlongStory(ctx, story._id);
  }
}

export async function deleteReadAlongForFamily(
  ctx: MutationCtx,
  familyId: Id<"families">,
): Promise<void> {
  const sessions = await ctx.db
    .query("readAlongSessions")
    .withIndex("by_family", (q) => q.eq("familyId", familyId))
    .collect();
  for (const session of sessions) {
    await deleteReadAlongSession(ctx, session._id);
  }

  const stories = await ctx.db
    .query("readAlongStories")
    .withIndex("by_family", (q) => q.eq("familyId", familyId))
    .collect();
  for (const story of stories) {
    await deleteReadAlongStory(ctx, story._id);
  }

  const recipes = await ctx.db
    .query("readAlongRecipes")
    .withIndex("by_family", (q) => q.eq("familyId", familyId))
    .collect();
  for (const recipe of recipes) {
    await ctx.db.delete("readAlongRecipes", recipe._id);
  }
}
