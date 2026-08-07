"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useAction } from "convex/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { api } from "../../../convex/_generated/api";
import { Button, Card, Input, Message, PageHeader } from "@/components/ui";

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

      await setPasswordDirect({ email, newPassword });

      const signInData = new FormData();
      signInData.set("email", email);
      signInData.set("password", newPassword);
      signInData.set("flow", "signIn");
      await signIn("password", signInData);
      router.push("/");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not update password. Check the email and try again.",
      );
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
          <Link href="/sign-in" className="font-medium text-[var(--accent)] hover:underline">
            Sign in
          </Link>
        </p>
      </Card>
    </div>
  );
}
