import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireSuperAdmin } from "./lib/auth";
import {
  speechDevTicketDocValidator,
  speechTicketStatusValidator,
} from "./lib/validators";

export const create = mutation({
  args: {
    title: v.string(),
    body: v.string(),
    sourceReportId: v.optional(v.id("speechWordReports")),
    status: v.optional(speechTicketStatusValidator),
  },
  returns: v.id("speechDevTickets"),
  handler: async (ctx, args) => {
    const admin = await requireSuperAdmin(ctx);
    const title = args.title.trim();
    const body = args.body.trim();
    if (!title || !body) throw new Error("Title and body are required");
    const now = Date.now();
    const ticketId = await ctx.db.insert("speechDevTickets", {
      title,
      body,
      sourceReportId: args.sourceReportId,
      status: args.status ?? "open",
      createdByAdminId: admin._id,
      createdAt: now,
      updatedAt: now,
    });
    if (args.sourceReportId) {
      const report = await ctx.db.get("speechWordReports", args.sourceReportId);
      if (report) {
        await ctx.db.patch("speechWordReports", args.sourceReportId, {
          ticketId,
          status: "ticketed",
          updatedAt: now,
        });
      }
    }
    return ticketId;
  },
});

export const list = query({
  args: { status: v.optional(speechTicketStatusValidator) },
  returns: v.array(speechDevTicketDocValidator),
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);
    if (args.status) {
      return await ctx.db
        .query("speechDevTickets")
        .withIndex("by_status", (q) => q.eq("status", args.status!))
        .take(200);
    }
    return await ctx.db.query("speechDevTickets").take(200);
  },
});

export const get = query({
  args: { ticketId: v.id("speechDevTickets") },
  returns: v.union(speechDevTicketDocValidator, v.null()),
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);
    return await ctx.db.get("speechDevTickets", args.ticketId);
  },
});

export const update = mutation({
  args: {
    ticketId: v.id("speechDevTickets"),
    title: v.optional(v.string()),
    body: v.optional(v.string()),
    status: v.optional(speechTicketStatusValidator),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);
    const doc = await ctx.db.get("speechDevTickets", args.ticketId);
    if (!doc) throw new Error("Ticket not found");
    const patch: {
      title?: string;
      body?: string;
      status?: typeof doc.status;
      updatedAt: number;
    } = { updatedAt: Date.now() };
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
    if (args.status !== undefined) patch.status = args.status;
    await ctx.db.patch("speechDevTickets", args.ticketId, patch);
    return null;
  },
});

export const remove = mutation({
  args: { ticketId: v.id("speechDevTickets") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);
    const doc = await ctx.db.get("speechDevTickets", args.ticketId);
    if (!doc) throw new Error("Ticket not found");
    if (doc.sourceReportId) {
      const report = await ctx.db.get("speechWordReports", doc.sourceReportId);
      if (report && report.ticketId === args.ticketId) {
        await ctx.db.patch("speechWordReports", doc.sourceReportId, {
          ticketId: undefined,
          status: report.status === "ticketed" ? "approved" : report.status,
          updatedAt: Date.now(),
        });
      }
    }
    await ctx.db.delete("speechDevTickets", args.ticketId);
    return null;
  },
});
