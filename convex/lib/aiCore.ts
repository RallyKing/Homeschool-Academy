import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

export async function deleteBadgeProposalsForStudent(
  ctx: MutationCtx,
  studentId: Id<"students">,
): Promise<void> {
  const rows = await ctx.db
    .query("badgeProposals")
    .withIndex("by_student", (q) => q.eq("studentId", studentId))
    .collect();
  for (const row of rows) {
    await ctx.db.delete("badgeProposals", row._id);
  }
}

export async function deleteBadgeProposalsForFamily(
  ctx: MutationCtx,
  familyId: Id<"families">,
): Promise<void> {
  const rows = await ctx.db
    .query("badgeProposals")
    .withIndex("by_family", (q) => q.eq("familyId", familyId))
    .collect();
  for (const row of rows) {
    await ctx.db.delete("badgeProposals", row._id);
  }
}
