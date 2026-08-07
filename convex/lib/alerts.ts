import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

export type AlertType =
  | "schedule_revision_requested"
  | "log_created"
  | "log_verified"
  | "schedule_approved"
  | "schedule_item_added"
  | "course_assigned"
  | "assignment_new"
  | "chore_assigned"
  | "chore_completed"
  | "reward_redeemed"
  | "accolade_awarded"
  | "kudos_received"
  | "general";

export type AlertRecipientType = "user" | "family" | "student";

type CreateAlertArgs = {
  recipientType: AlertRecipientType;
  recipientUserId?: Id<"users">;
  familyId?: Id<"families">;
  studentId?: Id<"students">;
  type: AlertType;
  title: string;
  body: string;
  href?: string;
  createdBy?: Id<"users">;
  sourceTable?: string;
  sourceId?: string;
};

export async function createAlert(
  ctx: MutationCtx,
  args: CreateAlertArgs,
): Promise<Id<"alerts">> {
  if (args.recipientType === "user" && !args.recipientUserId) {
    throw new Error("User alerts require recipientUserId");
  }
  if (args.recipientType === "family" && !args.familyId) {
    throw new Error("Family alerts require familyId");
  }
  if (args.recipientType === "student" && !args.studentId) {
    throw new Error("Student alerts require studentId");
  }

  const title = args.title.trim();
  const body = args.body.trim();
  if (!title) throw new Error("Alert title is required");
  if (!body) throw new Error("Alert body is required");

  return await ctx.db.insert("alerts", {
    recipientType: args.recipientType,
    recipientUserId: args.recipientUserId,
    familyId: args.familyId,
    studentId: args.studentId,
    type: args.type,
    title,
    body,
    href: args.href,
    createdAt: Date.now(),
    createdBy: args.createdBy,
    sourceTable: args.sourceTable,
    sourceId: args.sourceId,
  });
}

export async function alertFamily(
  ctx: MutationCtx,
  args: {
    familyId: Id<"families">;
    type: AlertType;
    title: string;
    body: string;
    href?: string;
    createdBy?: Id<"users">;
    studentId?: Id<"students">;
    sourceTable?: string;
    sourceId?: string;
  },
): Promise<Id<"alerts">> {
  return await createAlert(ctx, {
    recipientType: "family",
    familyId: args.familyId,
    studentId: args.studentId,
    type: args.type,
    title: args.title,
    body: args.body,
    href: args.href,
    createdBy: args.createdBy,
    sourceTable: args.sourceTable,
    sourceId: args.sourceId,
  });
}

/** Student-scoped alert for the student inbox (and parents who open the student record). */
export async function alertStudent(
  ctx: MutationCtx,
  args: {
    studentId: Id<"students">;
    type: AlertType;
    title: string;
    body: string;
    href?: string;
    createdBy?: Id<"users">;
    sourceTable?: string;
    sourceId?: string;
  },
): Promise<Id<"alerts">> {
  const student = await ctx.db.get("students", args.studentId);
  if (!student) {
    throw new Error("Student not found");
  }

  return await createAlert(ctx, {
    recipientType: "student",
    studentId: args.studentId,
    familyId: student.familyId,
    type: args.type,
    title: args.title,
    body: args.body,
    href: args.href,
    createdBy: args.createdBy,
    sourceTable: args.sourceTable,
    sourceId: args.sourceId,
  });
}

export async function deleteAlertsForStudent(
  ctx: MutationCtx,
  studentId: Id<"students">,
): Promise<void> {
  const alerts = await ctx.db
    .query("alerts")
    .withIndex("by_student", (q) => q.eq("studentId", studentId))
    .collect();
  for (const alert of alerts) {
    await ctx.db.delete("alerts", alert._id);
  }
}

export async function deleteAlertsForFamily(
  ctx: MutationCtx,
  familyId: Id<"families">,
): Promise<void> {
  const alerts = await ctx.db
    .query("alerts")
    .withIndex("by_family", (q) => q.eq("familyId", familyId))
    .collect();
  for (const alert of alerts) {
    await ctx.db.delete("alerts", alert._id);
  }
}
