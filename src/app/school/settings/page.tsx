import { redirect } from "next/navigation";

/** School settings alias → family settings Accounts tab. */
export default function SchoolSettingsRedirect() {
  redirect("/family/settings?tab=accounts");
}
