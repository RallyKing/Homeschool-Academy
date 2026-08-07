"use client";

import { useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { api } from "../../convex/_generated/api";

export function RoleRedirect({
  children,
}: {
  children?: React.ReactNode;
}) {
  const user = useQuery(api.users.current);
  const status = useQuery(
    api.users.onboardingStatus,
    user ? {} : "skip",
  );
  const router = useRouter();

  useEffect(() => {
    if (user === undefined) return;
    if (user === null) {
      router.replace("/sign-in");
      return;
    }
    if (status === undefined) return;
    router.replace(status.homePath);
  }, [user, status, router]);

  return (
    children ?? (
      <p className="p-6 text-sm text-neutral-500">Redirecting…</p>
    )
  );
}
