"use client";

import { useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { api } from "../../convex/_generated/api";

const roleHome: Record<string, string> = {
  superAdmin: "/admin",
  parent: "/family/dashboard",
  teacher: "/academy/dashboard",
  student: "/student/dashboard",
};

export function RoleRedirect({
  children,
}: {
  children?: React.ReactNode;
}) {
  const user = useQuery(api.users.current);
  const router = useRouter();

  useEffect(() => {
    if (user === undefined) return;
    if (user === null) {
      router.replace("/sign-in");
      return;
    }
    const role = user.role ?? "parent";
    const dest = roleHome[role] ?? "/family/dashboard";
    router.replace(dest);
  }, [user, router]);

  return (
    children ?? (
      <p className="p-6 text-sm text-neutral-500">Redirecting…</p>
    )
  );
}
