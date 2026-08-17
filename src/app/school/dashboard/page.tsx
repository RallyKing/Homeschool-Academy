import { redirect } from "next/navigation";

/** School dashboard alias → family dashboard. */
export default function SchoolDashboardRedirect() {
  redirect("/family/dashboard");
}
