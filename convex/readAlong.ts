import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import {
  getCurrentUser,
  getFamilyMembership,
  requireFamilyAccess,
  requireStudentFamilyAccess,
} from "./lib/auth";
import {
  awardProgress,
} from "./lib/gamificationCore";
import {
  deleteReadAlongSession,
  deleteReadAlongStory,
  deleteWordEventsForSession,
  pointsForCorrectWords,
  tokenizeStory,
} from "./lib/readAlongCore";
import {
  readAlongAgeBandValidator,
  readAlongSessionDocValidator,
  readAlongSessionStatusValidator,
  readAlongStoryDocValidator,
  readAlongWordEventDocValidator,
  readAlongWordResultValidator,
} from "./lib/validators";

const STORY_LIST_LIMIT = 80;
const SESSION_LIST_LIMIT = 80;
const EVENT_LIST_LIMIT = 250;

function uniqueWords(words: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of words) {
    const w = raw.trim();
    if (!w) continue;
    const key = w.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(w);
    if (out.length >= 80) break;
  }
  return out;
}

async function requireStoryAccess(
  ctx: QueryCtx | MutationCtx,
  familyId: Id<"families">,
  studentId?: Id<"students">,
) {
  if (studentId) {
    await requireStudentFamilyAccess(ctx, studentId);
    return;
  }
  const user = await getCurrentUser(ctx);
  if (user.role === "superAdmin") return;
  const membership = await getFamilyMembership(ctx, familyId, user._id);
  if (membership) return;
  const linked = await ctx.db
    .query("students")
    .withIndex("by_user", (q) => q.eq("userId", user._id))
    .first();
  if (linked && linked.familyId === familyId) return;
  throw new Error("Unauthorized: no access to this story");
}

export const create = mutation({
  args: {
    familyId: v.id("families"),
    studentId: v.optional(v.id("students")),
    title: v.string(),
    body: v.string(),
    ageBand: v.optional(readAlongAgeBandValidator),
    subject: v.optional(v.string()),
    recipeId: v.optional(v.id("readAlongRecipes")),
  },
  returns: v.id("readAlongStories"),
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    const title = args.title.trim();
    const body = args.body.trim();
    if (!title) throw new Error("Title is required");
    if (!body) throw new Error("Story text is required");

    if (args.studentId) {
      const { student } = await requireStudentFamilyAccess(ctx, args.studentId);
      if (student.familyId !== args.familyId) {
        throw new Error("Student is not in this family");
      }
    } else {
      await requireFamilyAccess(ctx, args.familyId);
    }

    const words = tokenizeStory(body);
    if (words.length === 0) throw new Error("Story needs at least one word");

    return await ctx.db.insert("readAlongStories", {
      familyId: args.familyId,
      studentId: args.studentId,
      title,
      body,
      words,
      wordCount: words.length,
      ageBand: args.ageBand,
      subject: args.subject?.trim() || undefined,
      recipeId: args.recipeId,
      createdBy: user._id,
      createdAt: Date.now(),
    });
  },
});

export const listForFamily = query({
  args: {
    familyId: v.id("families"),
    studentId: v.optional(v.id("students")),
  },
  returns: v.array(readAlongStoryDocValidator),
  handler: async (ctx, args) => {
    await requireFamilyAccess(ctx, args.familyId);
    const rows = await ctx.db
      .query("readAlongStories")
      .withIndex("by_family_and_createdAt", (q) =>
        q.eq("familyId", args.familyId),
      )
      .order("desc")
      .take(STORY_LIST_LIMIT);
    if (!args.studentId) return rows;
    return rows.filter(
      (s) => s.studentId === args.studentId || s.studentId === undefined,
    );
  },
});

export const listForStudent = query({
  args: { studentId: v.id("students") },
  returns: v.array(readAlongStoryDocValidator),
  handler: async (ctx, args) => {
    const { student } = await requireStudentFamilyAccess(ctx, args.studentId);
    const assigned = await ctx.db
      .query("readAlongStories")
      .withIndex("by_student", (q) => q.eq("studentId", args.studentId))
      .take(STORY_LIST_LIMIT);
    const family = await ctx.db
      .query("readAlongStories")
      .withIndex("by_family", (q) => q.eq("familyId", student.familyId))
      .take(STORY_LIST_LIMIT);
    const library = family.filter((s) => s.studentId === undefined);
    const seen = new Set(assigned.map((s) => s._id));
    const merged = [...assigned];
    for (const story of library) {
      if (!seen.has(story._id)) merged.push(story);
    }
    merged.sort((a, b) => b.createdAt - a.createdAt);
    return merged.slice(0, STORY_LIST_LIMIT);
  },
});

export const get = query({
  args: { storyId: v.id("readAlongStories") },
  returns: v.union(readAlongStoryDocValidator, v.null()),
  handler: async (ctx, args) => {
    const story = await ctx.db.get("readAlongStories", args.storyId);
    if (!story) return null;
    await requireStoryAccess(ctx, story.familyId, story.studentId);
    return story;
  },
});

export const update = mutation({
  args: {
    storyId: v.id("readAlongStories"),
    title: v.optional(v.string()),
    body: v.optional(v.string()),
    studentId: v.optional(v.union(v.id("students"), v.null())),
    ageBand: v.optional(readAlongAgeBandValidator),
    subject: v.optional(v.union(v.string(), v.null())),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const story = await ctx.db.get("readAlongStories", args.storyId);
    if (!story) throw new Error("Story not found");
    await requireFamilyAccess(ctx, story.familyId);

    const patch: {
      title?: string;
      body?: string;
      words?: string[];
      wordCount?: number;
      studentId?: Id<"students"> | undefined;
      ageBand?: typeof args.ageBand;
      subject?: string | undefined;
      updatedAt: number;
    } = { updatedAt: Date.now() };

    if (args.title !== undefined) {
      const title = args.title.trim();
      if (!title) throw new Error("Title is required");
      patch.title = title;
    }
    if (args.body !== undefined) {
      const body = args.body.trim();
      if (!body) throw new Error("Story text is required");
      const words = tokenizeStory(body);
      if (words.length === 0) throw new Error("Story needs at least one word");
      patch.body = body;
      patch.words = words;
      patch.wordCount = words.length;
    }
    if (args.studentId !== undefined) {
      if (args.studentId === null) {
        patch.studentId = undefined;
      } else {
        const { student } = await requireStudentFamilyAccess(
          ctx,
          args.studentId,
        );
        if (student.familyId !== story.familyId) {
          throw new Error("Student is not in this family");
        }
        patch.studentId = args.studentId;
      }
    }
    if (args.ageBand !== undefined) patch.ageBand = args.ageBand;
    if (args.subject !== undefined) {
      patch.subject = args.subject?.trim() || undefined;
    }

    await ctx.db.patch("readAlongStories", args.storyId, patch);
    return null;
  },
});

export const remove = mutation({
  args: { storyId: v.id("readAlongStories") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const story = await ctx.db.get("readAlongStories", args.storyId);
    if (!story) throw new Error("Story not found");
    await requireFamilyAccess(ctx, story.familyId);
    await deleteReadAlongStory(ctx, args.storyId);
    return null;
  },
});

export const startSession = mutation({
  args: {
    storyId: v.id("readAlongStories"),
    studentId: v.id("students"),
    startedAt: v.number(),
  },
  returns: v.id("readAlongSessions"),
  handler: async (ctx, args) => {
    const { student } = await requireStudentFamilyAccess(ctx, args.studentId);
    const story = await ctx.db.get("readAlongStories", args.storyId);
    if (!story) throw new Error("Story not found");
    if (story.familyId !== student.familyId) {
      throw new Error("Story is not in this family");
    }
    if (story.studentId && story.studentId !== student._id) {
      throw new Error("This story is assigned to another student");
    }

    const existing = await ctx.db
      .query("readAlongSessions")
      .withIndex("by_student_and_status", (q) =>
        q.eq("studentId", args.studentId).eq("status", "in_progress"),
      )
      .take(5);
    const resume = existing.find((s) => s.storyId === args.storyId);
    if (resume) return resume._id;

    return await ctx.db.insert("readAlongSessions", {
      storyId: args.storyId,
      studentId: args.studentId,
      familyId: student.familyId,
      status: "in_progress",
      startedAt: args.startedAt,
      currentWordIndex: 0,
      wordsCorrect: 0,
      wordsMissed: 0,
      pointsAwarded: 0,
      needsHelpWords: [],
      practicedWords: [],
      createdAt: Date.now(),
    });
  },
});

export const listSessionsForStudent = query({
  args: {
    studentId: v.id("students"),
    status: v.optional(readAlongSessionStatusValidator),
  },
  returns: v.array(
    v.object({
      session: readAlongSessionDocValidator,
      storyTitle: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    await requireStudentFamilyAccess(ctx, args.studentId);
    const sessions = args.status
      ? await ctx.db
          .query("readAlongSessions")
          .withIndex("by_student_and_status", (q) =>
            q.eq("studentId", args.studentId).eq("status", args.status!),
          )
          .take(SESSION_LIST_LIMIT)
      : await ctx.db
          .query("readAlongSessions")
          .withIndex("by_student", (q) => q.eq("studentId", args.studentId))
          .take(SESSION_LIST_LIMIT);

    const out = [];
    for (const session of sessions) {
      const story = await ctx.db.get("readAlongStories", session.storyId);
      out.push({
        session,
        storyTitle: story?.title ?? "Story",
      });
    }
    out.sort((a, b) => b.session.startedAt - a.session.startedAt);
    return out;
  },
});

export const listSessionsForFamily = query({
  args: {
    familyId: v.id("families"),
    studentId: v.optional(v.id("students")),
  },
  returns: v.array(
    v.object({
      session: readAlongSessionDocValidator,
      storyTitle: v.string(),
      studentName: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    await requireFamilyAccess(ctx, args.familyId);
    const sessions = args.studentId
      ? await ctx.db
          .query("readAlongSessions")
          .withIndex("by_student", (q) => q.eq("studentId", args.studentId!))
          .take(SESSION_LIST_LIMIT)
      : await ctx.db
          .query("readAlongSessions")
          .withIndex("by_family_and_createdAt", (q) =>
            q.eq("familyId", args.familyId),
          )
          .order("desc")
          .take(SESSION_LIST_LIMIT);

    const out = [];
    for (const session of sessions) {
      if (session.familyId !== args.familyId) continue;
      const story = await ctx.db.get("readAlongStories", session.storyId);
      const student = await ctx.db.get("students", session.studentId);
      out.push({
        session,
        storyTitle: story?.title ?? "Story",
        studentName: student?.displayName ?? "Student",
      });
    }
    out.sort((a, b) => b.session.startedAt - a.session.startedAt);
    return out;
  },
});

export const getSession = query({
  args: { sessionId: v.id("readAlongSessions") },
  returns: v.union(
    v.object({
      session: readAlongSessionDocValidator,
      story: readAlongStoryDocValidator,
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const session = await ctx.db.get("readAlongSessions", args.sessionId);
    if (!session) return null;
    await requireStudentFamilyAccess(ctx, session.studentId);
    const story = await ctx.db.get("readAlongStories", session.storyId);
    if (!story) return null;
    return { session, story };
  },
});

export const updateSession = mutation({
  args: {
    sessionId: v.id("readAlongSessions"),
    status: v.optional(readAlongSessionStatusValidator),
    currentWordIndex: v.optional(v.number()),
    needsHelpWords: v.optional(v.array(v.string())),
    practicedWords: v.optional(v.array(v.string())),
    logId: v.optional(v.id("logs")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const session = await ctx.db.get("readAlongSessions", args.sessionId);
    if (!session) throw new Error("Session not found");
    await requireStudentFamilyAccess(ctx, session.studentId);

    const patch: {
      status?: typeof session.status;
      currentWordIndex?: number;
      needsHelpWords?: string[];
      practicedWords?: string[];
      logId?: Id<"logs">;
      updatedAt: number;
    } = { updatedAt: Date.now() };
    if (args.status !== undefined) patch.status = args.status;
    if (args.currentWordIndex !== undefined) {
      patch.currentWordIndex = Math.max(0, args.currentWordIndex);
    }
    if (args.needsHelpWords !== undefined) {
      patch.needsHelpWords = uniqueWords(args.needsHelpWords);
    }
    if (args.practicedWords !== undefined) {
      patch.practicedWords = uniqueWords(args.practicedWords);
    }
    if (args.logId !== undefined) patch.logId = args.logId;
    await ctx.db.patch("readAlongSessions", args.sessionId, patch);
    return null;
  },
});

export const removeSession = mutation({
  args: { sessionId: v.id("readAlongSessions") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const session = await ctx.db.get("readAlongSessions", args.sessionId);
    if (!session) throw new Error("Session not found");
    await requireFamilyAccess(ctx, session.familyId);
    await deleteReadAlongSession(ctx, args.sessionId);
    return null;
  },
});

export const recordWordResults = mutation({
  args: {
    sessionId: v.id("readAlongSessions"),
    events: v.array(
      v.object({
        wordIndex: v.number(),
        word: v.string(),
        result: readAlongWordResultValidator,
      }),
    ),
    currentWordIndex: v.number(),
    needsHelpWords: v.optional(v.array(v.string())),
    today: v.string(),
    weekStart: v.optional(v.string()),
  },
  returns: v.object({
    wordsCorrect: v.number(),
    wordsMissed: v.number(),
    pointsAwarded: v.number(),
    pointsGained: v.number(),
    needsHelpWords: v.array(v.string()),
  }),
  handler: async (ctx, args) => {
    const session = await ctx.db.get("readAlongSessions", args.sessionId);
    if (!session) throw new Error("Session not found");
    const { student } = await requireStudentFamilyAccess(
      ctx,
      session.studentId,
    );
    if (session.status === "completed") {
      throw new Error("Session already completed");
    }
    if (args.events.length > 40) {
      throw new Error("Too many word events in one batch");
    }

    let wordsCorrect = session.wordsCorrect;
    let wordsMissed = session.wordsMissed;
    for (const event of args.events) {
      await ctx.db.insert("readAlongWordEvents", {
        sessionId: args.sessionId,
        wordIndex: event.wordIndex,
        word: event.word,
        result: event.result,
        createdAt: Date.now(),
      });
      if (event.result === "helped") {
        wordsMissed += 1;
      } else {
        wordsCorrect += 1;
      }
    }

    const targetPoints = pointsForCorrectWords(wordsCorrect);
    const pointsDelta = Math.max(0, targetPoints - session.pointsAwarded);
    let pointsAwarded = session.pointsAwarded;
    if (pointsDelta > 0) {
      await awardProgress(ctx, {
        studentId: student._id,
        familyId: student.familyId,
        today: args.today,
        weekStart: args.weekStart,
        xp: 0,
        points: pointsDelta,
        stars: 0,
        source: "read_along",
        sourceId: args.sessionId,
        skipStreak: true,
      });
      pointsAwarded += pointsDelta;
    }

    const needsHelpWords = uniqueWords([
      ...session.needsHelpWords,
      ...(args.needsHelpWords ?? []),
    ]);

    await ctx.db.patch("readAlongSessions", args.sessionId, {
      currentWordIndex: Math.max(0, args.currentWordIndex),
      wordsCorrect,
      wordsMissed,
      pointsAwarded,
      needsHelpWords,
      updatedAt: Date.now(),
    });

    return {
      wordsCorrect,
      wordsMissed,
      pointsAwarded,
      pointsGained: pointsDelta,
      needsHelpWords,
    };
  },
});

export const enterPractice = mutation({
  args: { sessionId: v.id("readAlongSessions") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const session = await ctx.db.get("readAlongSessions", args.sessionId);
    if (!session) throw new Error("Session not found");
    await requireStudentFamilyAccess(ctx, session.studentId);
    if (session.status === "completed") {
      throw new Error("Session already completed");
    }
    await ctx.db.patch("readAlongSessions", args.sessionId, {
      status: "practice",
      updatedAt: Date.now(),
    });
    return null;
  },
});

export const recordPracticeWord = mutation({
  args: {
    sessionId: v.id("readAlongSessions"),
    word: v.string(),
    today: v.string(),
    weekStart: v.optional(v.string()),
  },
  returns: v.object({
    practicedWords: v.array(v.string()),
    pointsGained: v.number(),
  }),
  handler: async (ctx, args) => {
    const session = await ctx.db.get("readAlongSessions", args.sessionId);
    if (!session) throw new Error("Session not found");
    const { student } = await requireStudentFamilyAccess(
      ctx,
      session.studentId,
    );
    const word = args.word.trim();
    if (!word) throw new Error("Word is required");

    const practiced = uniqueWords([...(session.practicedWords ?? []), word]);
    const already = (session.practicedWords ?? []).some(
      (w) => w.toLowerCase() === word.toLowerCase(),
    );
    let pointsGained = 0;
    if (!already) {
      await awardProgress(ctx, {
        studentId: student._id,
        familyId: student.familyId,
        today: args.today,
        weekStart: args.weekStart,
        xp: 0,
        points: 1,
        stars: 0,
        source: "read_along",
        sourceId: args.sessionId,
        skipStreak: true,
      });
      pointsGained = 1;
    }

    await ctx.db.patch("readAlongSessions", args.sessionId, {
      practicedWords: practiced,
      pointsAwarded: session.pointsAwarded + pointsGained,
      updatedAt: Date.now(),
    });
    return { practicedWords: practiced, pointsGained };
  },
});

export const finishSession = mutation({
  args: {
    sessionId: v.id("readAlongSessions"),
    endedAt: v.number(),
    logId: v.optional(v.id("logs")),
  },
  returns: v.object({
    durationMs: v.number(),
    durationMinutes: v.number(),
    wordsCorrect: v.number(),
    wordsMissed: v.number(),
    pointsAwarded: v.number(),
  }),
  handler: async (ctx, args) => {
    const session = await ctx.db.get("readAlongSessions", args.sessionId);
    if (!session) throw new Error("Session not found");
    await requireStudentFamilyAccess(ctx, session.studentId);

    const durationMs = Math.max(0, args.endedAt - session.startedAt);
    const durationMinutes = Math.max(1, Math.round(durationMs / 60000));

    await ctx.db.patch("readAlongSessions", args.sessionId, {
      status: "completed",
      endedAt: args.endedAt,
      durationMs,
      logId: args.logId ?? session.logId,
      updatedAt: Date.now(),
    });

    return {
      durationMs,
      durationMinutes,
      wordsCorrect: session.wordsCorrect,
      wordsMissed: session.wordsMissed,
      pointsAwarded: session.pointsAwarded,
    };
  },
});

export const listWordEvents = query({
  args: {
    sessionId: v.id("readAlongSessions"),
    limit: v.optional(v.number()),
  },
  returns: v.array(readAlongWordEventDocValidator),
  handler: async (ctx, args) => {
    const session = await ctx.db.get("readAlongSessions", args.sessionId);
    if (!session) throw new Error("Session not found");
    await requireStudentFamilyAccess(ctx, session.studentId);
    const limit = Math.min(args.limit ?? EVENT_LIST_LIMIT, EVENT_LIST_LIMIT);
    return await ctx.db
      .query("readAlongWordEvents")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .take(limit);
  },
});

export const getWordEvent = query({
  args: { eventId: v.id("readAlongWordEvents") },
  returns: v.union(readAlongWordEventDocValidator, v.null()),
  handler: async (ctx, args) => {
    const event = await ctx.db.get("readAlongWordEvents", args.eventId);
    if (!event) return null;
    const session = await ctx.db.get("readAlongSessions", event.sessionId);
    if (!session) return null;
    await requireStudentFamilyAccess(ctx, session.studentId);
    return event;
  },
});

export const updateWordEvent = mutation({
  args: {
    eventId: v.id("readAlongWordEvents"),
    result: v.optional(readAlongWordResultValidator),
    word: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const event = await ctx.db.get("readAlongWordEvents", args.eventId);
    if (!event) throw new Error("Word event not found");
    const session = await ctx.db.get("readAlongSessions", event.sessionId);
    if (!session) throw new Error("Session not found");
    await requireFamilyAccess(ctx, session.familyId);
    const patch: { result?: typeof event.result; word?: string } = {};
    if (args.result !== undefined) patch.result = args.result;
    if (args.word !== undefined) {
      const word = args.word.trim();
      if (!word) throw new Error("Word is required");
      patch.word = word;
    }
    await ctx.db.patch("readAlongWordEvents", args.eventId, patch);
    return null;
  },
});

export const removeWordEvent = mutation({
  args: { eventId: v.id("readAlongWordEvents") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const event = await ctx.db.get("readAlongWordEvents", args.eventId);
    if (!event) throw new Error("Word event not found");
    const session = await ctx.db.get("readAlongSessions", event.sessionId);
    if (!session) throw new Error("Session not found");
    await requireFamilyAccess(ctx, session.familyId);
    await ctx.db.delete("readAlongWordEvents", args.eventId);
    return null;
  },
});

export const clearWordEvents = mutation({
  args: { sessionId: v.id("readAlongSessions") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const session = await ctx.db.get("readAlongSessions", args.sessionId);
    if (!session) throw new Error("Session not found");
    await requireFamilyAccess(ctx, session.familyId);
    await deleteWordEventsForSession(ctx, args.sessionId);
    return null;
  },
});
