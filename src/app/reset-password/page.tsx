"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useAction } from "convex/react";
import { ConvexError } from "convex/values";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { api } from "../../../convex/_generated/api";
import { Button, Card, Input, Message, PageHeader } from "@/components/ui";

function formatResetError(err: unknown): string {
  if (err instanceof ConvexError) {
    const data = err.data;
    if (typeof data === "string" && data.trim()) {
      return data;
    }
  }
  if (err instanceof Error && err.message.trim()) {
    // Convex wraps action failures as:
    // [CONVEX A(...)] [Request ID: ...] Server Error\n\nActual message
    const lines = err.message
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    const meaningful = lines.find(
      (l) =>
        !l.startsWith("[CONVEX") &&
        !l.startsWith("Called by") &&
        l !== "Server Error",
    );
    if (meaningful) {
      return meaningful;
    }
    if (!err.message.includes("Server Error")) {
      return err.message;
    }
  }
  return "Could not update password. Check the email and try again.";
}

export default function ResetPasswordPage() {
  const { signIn } = useAuthActions();
  const setPasswordDirect = useAction(api.passwordReset.setPasswordDirect);
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "").trim();
    const newPassword = String(formData.get("newPassword") ?? "");
    const confirmPassword = String(formData.get("confirmPassword") ?? "");

    try {
      if (newPassword !== confirmPassword) {
        throw new Error("Passwords do not match");
      }
      if (newPassword.length < 8) {
        throw new Error("Password must be at least 8 characters");
      }

      const result = await setPasswordDirect({ email, newPassword });

      // Sign in with normalized (lowercase) email returned by the action.
      const signInData = new FormData();
      signInData.set("email", result.email);
      signInData.set("password", newPassword);
      signInData.set("flow", "signIn");
      await signIn("password", signInData);
      router.push("/");
    } catch (err) {
      setError(formatResetError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md animate-fade-up">
      <PageHeader
        title="Reset password"
        description="Enter your account email and choose a new password."
      />
      <Card>
        <form onSubmit={(e) => void onSubmit(e)} className="space-y-4">
          <Input
            name="email"
            type="email"
            label="Email"
            required
            autoComplete="email"
          />
          <Input
            name="newPassword"
            type="password"
            label="New password"
            required
            minLength={8}
            autoComplete="new-password"
          />
          <Input
            name="confirmPassword"
            type="password"
            label="Confirm password"
            required
            minLength={8}
            autoComplete="new-password"
          />
          <Message tone="error">{error}</Message>
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Updating…" : "Set new password"}
          </Button>
        </form>
        <p className="mt-5 text-sm text-[var(--muted)]">
          Remembered it?{" "}
          <Link href="/sign-in" className="hover-link font-medium text-[var(--accent)] underline-offset-2">
            Sign in
          </Link>
        </p>
      </Card>
    </div>
  );
}
