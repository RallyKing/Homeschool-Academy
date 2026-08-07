"use client";

import { ChangeEvent, useEffect, useRef, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { StudentAvatar } from "@/components/StudentAvatar";
import { Button } from "@/components/ui";

const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPT = "image/jpeg,image/png,image/webp,image/gif";

export function StudentPhotoEditor({
  studentId,
  imageStorageId,
  name,
  size = "lg",
  onError,
  onSuccess,
}: {
  studentId: Id<"students">;
  imageStorageId?: Id<"_storage">;
  name: string;
  size?: "md" | "lg" | "xl";
  onError?: (message: string) => void;
  onSuccess?: (message: string) => void;
}) {
  const generateUploadUrl = useMutation(api.students.generateUploadUrl);
  const setProfileImage = useMutation(api.students.setProfileImage);
  const clearProfileImage = useMutation(api.students.clearProfileImage);

  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function resetPicker() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setPendingFile(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  function onPick(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      onError?.("Please choose an image file.");
      resetPicker();
      return;
    }
    if (file.size > MAX_BYTES) {
      onError?.("Image must be 5 MB or smaller.");
      resetPicker();
      return;
    }

    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPendingFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  }

  async function onSave() {
    if (!pendingFile) return;
    setBusy(true);
    try {
      const uploadUrl = await generateUploadUrl({});
      const result = await fetch(uploadUrl, {
        method: "POST",
        headers: {
          "Content-Type": pendingFile.type || "application/octet-stream",
        },
        body: pendingFile,
      });
      if (!result.ok) {
        throw new Error("Upload failed");
      }
      const json = (await result.json()) as { storageId: Id<"_storage"> };
      await setProfileImage({
        studentId,
        storageId: json.storageId,
      });
      resetPicker();
      onSuccess?.("Profile photo updated.");
    } catch (err) {
      onError?.(err instanceof Error ? err.message : "Failed to save photo");
    } finally {
      setBusy(false);
    }
  }

  async function onClear() {
    if (!imageStorageId && !pendingFile) return;
    if (pendingFile) {
      resetPicker();
      return;
    }
    if (!window.confirm("Remove this profile photo?")) return;
    setBusy(true);
    try {
      await clearProfileImage({ studentId });
      onSuccess?.("Profile photo removed.");
    } catch (err) {
      onError?.(err instanceof Error ? err.message : "Failed to remove photo");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-4">
      {previewUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={previewUrl}
          alt="Preview"
          className={
            size === "xl"
              ? "h-20 w-20 rounded-full object-cover border border-[var(--border)]"
              : size === "lg"
                ? "h-16 w-16 rounded-full object-cover border border-[var(--border)]"
                : "h-11 w-11 rounded-full object-cover border border-[var(--border)]"
          }
        />
      ) : (
        <StudentAvatar
          studentId={studentId}
          imageStorageId={imageStorageId}
          name={name}
          size={size}
        />
      )}

      <div className="flex min-w-0 flex-col gap-2">
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            Change photo
          </Button>
          {pendingFile ? (
            <Button
              type="button"
              size="sm"
              disabled={busy}
              onClick={() => void onSave()}
            >
              {busy ? "Saving…" : "Save photo"}
            </Button>
          ) : null}
          {imageStorageId || pendingFile ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => void onClear()}
            >
              {pendingFile ? "Cancel" : "Remove photo"}
            </Button>
          ) : null}
        </div>
        <p className="text-xs text-[var(--muted)]">
          JPG, PNG, or WebP · up to 5 MB
        </p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="sr-only"
        onChange={onPick}
      />
    </div>
  );
}
