import { redirect } from "next/navigation";

/** Legacy / alternate path — chores & rewards live together. */
export default function FamilyRewardsRedirect() {
  redirect("/family/chores?tab=rewards");
}
