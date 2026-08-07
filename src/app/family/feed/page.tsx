import { redirect } from "next/navigation";

/** Alias → Family wall (cheers page Wall tab). */
export default function FamilyFeedRedirectPage() {
  redirect("/family/cheers?tab=wall");
}
