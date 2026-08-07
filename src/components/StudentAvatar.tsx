"use client";

import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

const SIZE_CLASS = {
  sm: "h-8 w-8 text-xs",
  md: "h-11 w-11 text-sm",
  lg: "h-16 w-16 text-lg",
  xl: "h-20 w-20 text-xl",
} as const;

function initialsFromName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
}

export function StudentAvatar({
  studentId,
  imageStorageId,
  name,
  size = "md",
  className = "",
}: {
  studentId: Id<"students">;
  imageStorageId?: Id<"_storage">;
  name: string;
  size?: keyof typeof SIZE_CLASS;
  className?: string;
}) {
  const url = useQuery(
    api.students.getProfileImageUrl,
    imageStorageId ? { studentId } : "skip",
  );

  const base =
    `inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full ` +
    `border border-[var(--border)] bg-[var(--surface-2)] font-semibold ` +
    `text-[var(--muted)] ${SIZE_CLASS[size]} ${className}`;

  if (imageStorageId && url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={`${name} profile`}
        className={`${base} object-cover`}
      />
    );
  }

  return (
    <span className={base} aria-hidden={false} aria-label={`${name} avatar`}>
      {initialsFromName(name)}
    </span>
  );
}
