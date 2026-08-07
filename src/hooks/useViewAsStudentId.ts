"use client";

import { useSearchParams } from "next/navigation";
import { VIEW_AS_PARAM } from "@/lib/viewAs";
import type { Id } from "../../convex/_generated/dataModel";

export function useViewAsStudentId(): Id<"students"> | null {
  const searchParams = useSearchParams();
  const raw = searchParams.get(VIEW_AS_PARAM);
  if (!raw) return null;
  return raw as Id<"students">;
}
