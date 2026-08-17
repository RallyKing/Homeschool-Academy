import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { getCurrentUser, requireSuperAdmin } from "./lib/auth";
import {
  normalizeSpeechWord,
  resolveReporterRole,
  type SpeechReporterRole,
} from "./lib/speechReportAuth";
import { buildSpeechTicketPrompt } from "./lib/speechTicketPrompt";
import {
  speechReportStatusValidator,
  speechReporterRoleValidator,
  speechWordReportDocValidator,
} from "./lib/validators";

const MAX_SAMPLES = 8;

const createArgs = {
  word: v.string(),
  notes: v.optional(v.string()),
  studentId: v.optional(v.id("students")),
  sessionId: v.optional(v.id("readAlongSessions")),
  storyId: v.optional(v.id("readAlongStories")),
};

async function contextFromSession(
  ctx: MutationCtx,
  sessionId?: Id<"readAlongSessions">,
  storyId?: Id<"readAlongStories">,
  studentId?: Id<"students">,
): Promise<{
  studentId?: Id<"students">;
  sessionId?: Id<"readAlongSessions">;
  storyId?: Id<"readAlongStories">;
  familyId?: Id<"families">;
}> {
  let resolvedStudent = studentId;
  let resolvedStory = storyId;
  let resolvedSession = sessionId;
  let familyId: Id<"families"> | undefined;
  if (sessionId) {
    const session = await ctx.db.get("readAlongSessions", sessionId);
    if (session) {
      resolvedSession = session._id;
      resolvedStudent = session.studentId;
      resolvedStory = session.storyId;
      familyId = session.familyId;
    }
  }
  if (!familyId && resolvedStudent) {
    const student = await ctx.db.get("students", resolvedStudent);
    familyId = student?.familyId;
  }
  if (!familyId && resolvedStory) {
    const story = await ctx.db.get("readAlongStories", resolvedStory);
    familyId = story?.familyId;
  }
  return {
    studentId: resolvedStudent,
    sessionId: resolvedSession,
    storyId: resolvedStory,
    familyId,
  };
}

async function insertReport(
  ctx: MutationCtx,
  args: {
    word: string;
    notes?: string;
    studentId?: Id<"students">;
    sessionId?: Id<"readAlongSessions">;
    storyId?: Id<"readAlongStories">;
    reporter: Doc<"users">;
    reporterRole: SpeechReporterRole;
  },
): Promise<Id<"speechWordReports">> {
  const word = args.word.trim();
  if (!word) throw new Error("Word is required");
  const ctxIds = await contextFromSession(
    ctx,
    args.sessionId,
    args.storyId,
    args.studentId,
  );
  const now = Date.now();
  return await ctx.db.insert("speechWordReports", {
    word,
    normalizedWord: normalizeSpeechWord(word),
    reportedByUserId: args.reporter._id,
    reporterRole: args.reporterRole,
    studentId: ctxIds.studentId,
    sessionId: ctxIds.sessionId,
    storyId: ctxIds.storyId,
    familyId: ctxIds.familyId,
    status: "open",
    notes: args.notes?.trim() || undefined,
    createdAt: now,
    updatedAt: now,
  });
}

export const reporterAccess = query({
  args: { studentId: v.optional(v.id("students")) },
  returns: v.object({
    canSubmitDirectly: v.boolean(),
    reporterRole: v.union(speechReporterRoleValidator, v.null()),
    isStudent: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    const isStudent = (user.role ?? "parent") === "student";
    const reporterRole = await resolveReporterRole(
      ctx,
      user,
      undefined,
      args.studentId,
    );
    return {
      canSubmitDirectly: reporterRole !== null,
      reporterRole,
      isStudent,
    };
  },
});

export const create = mutation({
  args: createArgs,
  returns: v.id("speechWordReports"),
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    const ctxIds = await contextFromSession(
      ctx,
      args.sessionId,
      args.storyId,
      args.studentId,
    );
    const reporterRole = await resolveReporterRole(
      ctx,
      user,
      ctxIds.familyId,
      ctxIds.studentId,
    );
    if (!reporterRole) {
      throw new Error(
        "A parent admin, teacher, or tutor must report this word.",
      );
    }
    return await insertReport(ctx, {
      word: args.word,
      notes: args.notes,
      studentId: args.studentId,
      sessionId: args.sessionId,
      storyId: args.storyId,
      reporter: user,
      reporterRole,
    });
  },
});

export const insertAsReporter = internalMutation({
  args: {
    ...createArgs,
    reporterUserId: v.id("users"),
  },
  returns: v.id("speechWordReports"),
  handler: async (ctx, args) => {
    const reporter = await ctx.db.get("users", args.reporterUserId);
    if (!reporter) throw new Error("User not found");
    const ctxIds = await contextFromSession(
      ctx,
      args.sessionId,
      args.storyId,
      args.studentId,
    );
    const reporterRole = await resolveReporterRole(
      ctx,
      reporter,
      ctxIds.familyId,
      ctxIds.studentId,
    );
    if (!reporterRole) {
      throw new Error(
        "That account cannot report words. Ask a parent admin, teacher, or tutor.",
      );
    }
    return await insertReport(ctx, {
      word: args.word,
      notes: args.notes,
      studentId: args.studentId,
      sessionId: args.sessionId,
      storyId: args.storyId,
      reporter,
      reporterRole,
    });
  },
});

export const findPasswordAccountWithSecret = internalQuery({
  args: { email: v.string() },
  returns: v.union(
    v.object({
      userId: v.id("users"),
      secret: v.string(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const normalized = args.email.trim().toLowerCase();
    if (!normalized.includes("@")) return null;
    const emails = Array.from(
      new Set([args.email.trim(), normalized].filter(Boolean)),
    );
    for (const email of emails) {
      const user = await ctx.db
        .query("users")
        .withIndex("email", (q) => q.eq("email", email))
        .unique();
      if (!user) continue;
      if (user.email) {
        const byEmail = await ctx.db
          .query("authAccounts")
          .withIndex("providerAndAccountId", (q) =>
            q.eq("provider", "password").eq("providerAccountId", user.email!),
          )
          .unique();
        if (byEmail?.secret) {
          return { userId: byEmail.userId as Id<"users">, secret: byEmail.secret };
        }
      }
      const accounts = await ctx.db.query("authAccounts").take(500);
      const match = accounts.find(
        (a) =>
          a.provider === "password" &&
          a.userId === user._id &&
          a.providerAccountId.toLowerCase() === normalized &&
          typeof a.secret === "string",
      );
      if (match?.secret) {
        return { userId: match.userId as Id<"users">, secret: match.secret };
      }
    }
    return null;
  },
});

export const list = query({
  args: {
    status: v.optional(speechReportStatusValidator),
    word: v.optional(v.string()),
  },
  returns: v.array(speechWordReportDocValidator),
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);
    if (args.word) {
      const normalized = normalizeSpeechWord(args.word);
      const rows = await ctx.db
        .query("speechWordReports")
        .withIndex("by_word", (q) => q.eq("normalizedWord", normalized))
        .take(200);
      return args.status
        ? rows.filter((row) => row.status === args.status)
        : rows;
    }
    if (args.status) {
      return await ctx.db
        .query("speechWordReports")
        .withIndex("by_status", (q) => q.eq("status", args.status!))
        .take(200);
    }
    return await ctx.db.query("speechWordReports").take(200);
  },
});

export const listMine = query({
  args: {},
  returns: v.array(speechWordReportDocValidator),
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    return await ctx.db
      .query("speechWordReports")
      .withIndex("by_reporter", (q) => q.eq("reportedByUserId", user._id))
      .take(200);
  },
});

export const get = query({
  args: { reportId: v.id("speechWordReports") },
  returns: v.union(speechWordReportDocValidator, v.null()),
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    const doc = await ctx.db.get("speechWordReports", args.reportId);
    if (!doc) return null;
    if (user.role === "superAdmin" || doc.reportedByUserId === user._id) {
      return doc;
    }
    throw new Error("Unauthorized");
  },
});

export const update = mutation({
  args: {
    reportId: v.id("speechWordReports"),
    notes: v.optional(v.string()),
    status: v.optional(speechReportStatusValidator),
    word: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    const doc = await ctx.db.get("speechWordReports", args.reportId);
    if (!doc) throw new Error("Report not found");
    const isAdmin = user.role === "superAdmin";
    const isOwner = doc.reportedByUserId === user._id;
    if (!isAdmin && !isOwner) throw new Error("Unauthorized");
    if (!isAdmin && args.status !== undefined) {
      throw new Error("Unauthorized: only backoffice can change status");
    }
    const patch: {
      notes?: string;
      status?: typeof doc.status;
      word?: string;
      normalizedWord?: string;
      updatedAt: number;
    } = { updatedAt: Date.now() };
    if (args.notes !== undefined) patch.notes = args.notes.trim() || undefined;
    if (args.status !== undefined) patch.status = args.status;
    if (args.word !== undefined) {
      const word = args.word.trim();
      if (!word) throw new Error("Word is required");
      patch.word = word;
      patch.normalizedWord = normalizeSpeechWord(word);
    }
    await ctx.db.patch("speechWordReports", args.reportId, patch);
    return null;
  },
});

export const addSample = mutation({
  args: {
    reportId: v.id("speechWordReports"),
    transcript: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);
    const doc = await ctx.db.get("speechWordReports", args.reportId);
    if (!doc) throw new Error("Report not found");
    const transcript = args.transcript.trim();
    if (!transcript) throw new Error("Transcript is required");
    const existing = doc.recognitionSamples ?? [];
    const next = [
      ...existing,
      { transcript, at: Date.now() },
    ].slice(-MAX_SAMPLES);
    await ctx.db.patch("speechWordReports", args.reportId, {
      recognitionSamples: next,
      status: doc.status === "open" ? "testing" : doc.status,
      updatedAt: Date.now(),
    });
    return null;
  },
});

export const approve = mutation({
  args: { reportId: v.id("speechWordReports") },
  returns: v.id("speechDevTickets"),
  handler: async (ctx, args) => {
    const admin = await requireSuperAdmin(ctx);
    const doc = await ctx.db.get("speechWordReports", args.reportId);
    if (!doc) throw new Error("Report not found");
    if (doc.ticketId) {
      const existing = await ctx.db.get("speechDevTickets", doc.ticketId);
      if (existing) return existing._id;
    }
    const heardAs = (doc.recognitionSamples ?? []).map((s) => s.transcript);
    const prompt = buildSpeechTicketPrompt({
      word: doc.word,
      heardAs,
      notes: doc.notes,
    });
    const now = Date.now();
    const ticketId = await ctx.db.insert("speechDevTickets", {
      title: prompt.title,
      body: prompt.body,
      sourceReportId: doc._id,
      status: "open",
      createdByAdminId: admin._id,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.patch("speechWordReports", args.reportId, {
      status: "ticketed",
      ticketId,
      updatedAt: now,
    });
    return ticketId;
  },
});

export const reject = mutation({
  args: {
    reportId: v.id("speechWordReports"),
    notes: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);
    const doc = await ctx.db.get("speechWordReports", args.reportId);
    if (!doc) throw new Error("Report not found");
    await ctx.db.patch("speechWordReports", args.reportId, {
      status: "rejected",
      notes: args.notes?.trim() || doc.notes,
      updatedAt: Date.now(),
    });
    return null;
  },
});

export const remove = mutation({
  args: { reportId: v.id("speechWordReports") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    const doc = await ctx.db.get("speechWordReports", args.reportId);
    if (!doc) throw new Error("Report not found");
    const isAdmin = user.role === "superAdmin";
    const isOwner = doc.reportedByUserId === user._id;
    if (!isAdmin && !(isOwner && doc.status === "open")) {
      throw new Error("Unauthorized");
    }
    if (doc.ticketId) {
      const ticket = await ctx.db.get("speechDevTickets", doc.ticketId);
      if (ticket) await ctx.db.delete("speechDevTickets", doc.ticketId);
    }
    await ctx.db.delete("speechWordReports", args.reportId);
    return null;
  },
});
